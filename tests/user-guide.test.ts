import { describe, expect, it } from "vitest";
import {
  buildUserGuidePayload,
  searchGuideSections,
} from "../src/lib/user-guide/guide-data";

describe("role-aware Kairo User Guide", () => {
  it("shows every authenticated role its own role guide", () => {
    for (const role of [
      "Employee",
      "Manager",
      "Admin",
      "Finance Admin",
      "Super Admin",
    ] as const) {
      const payload = buildUserGuidePayload({ name: "Kairo User", role });
      expect(payload.profile.role).toBe(role);
      expect(payload.allowedRoles).toContain(role);
      expect(payload.roleCapabilities.some((item) => item.role === role)).toBe(true);
    }
  });

  it("does not send restricted invoice and Work Order details to employees", () => {
    const payload = buildUserGuidePayload({ name: "Employee", role: "Employee" });
    expect(payload.sections.some((section) => section.id === "invoices")).toBe(false);
    const accounts = payload.sections.find((section) => section.id === "accounts");
    expect(accounts?.blocks.some((block) => block.title === "Commercial Work Orders")).toBe(false);
    expect(accounts?.workflows?.some((workflow) => /Work Order/.test(workflow.title))).toBe(false);
  });

  it("documents Work Orders for the two authorised roles", () => {
    for (const role of ["Finance Admin", "Super Admin"] as const) {
      const accounts = buildUserGuidePayload({ name: role, role }).sections.find(
        (section) => section.id === "accounts",
      );
      expect(accounts?.blocks.some((block) => block.title === "Commercial Work Orders")).toBe(true);
    }
  });

  it("keeps payroll administration Finance Admin-only", () => {
    const finance = buildUserGuidePayload({ name: "Finance", role: "Finance Admin" });
    const superAdmin = buildUserGuidePayload({ name: "Super", role: "Super Admin" });
    expect(finance.sections.find((section) => section.id === "payroll")?.blocks.some((block) => block.title === "Payroll Administration")).toBe(true);
    expect(superAdmin.sections.find((section) => section.id === "payroll")?.blocks.some((block) => block.title === "Payroll Administration")).toBe(false);
  });

  it("limits role comparison tabs according to the viewer", () => {
    expect(buildUserGuidePayload({ name: "Employee", role: "Employee" }).allowedRoles).toEqual(["Employee"]);
    expect(buildUserGuidePayload({ name: "Manager", role: "Manager" }).allowedRoles).toEqual(["Employee", "Manager"]);
    expect(buildUserGuidePayload({ name: "Admin", role: "Admin" }).allowedRoles).toEqual(["Employee", "Manager", "Admin"]);
    expect(buildUserGuidePayload({ name: "Finance", role: "Finance Admin" }).allowedRoles).toHaveLength(5);
  });

  it("searches titles, keywords, descriptions, permissions, and workflows", () => {
    const sections = buildUserGuidePayload({ name: "Finance", role: "Finance Admin" }).sections;
    expect(searchGuideSections(sections, "leave").some((section) => section.id === "time-off")).toBe(true);
    expect(searchGuideSections(sections, "work order").some((section) => section.id === "accounts")).toBe(true);
    expect(searchGuideSections(sections, "recurring invoice").some((section) => section.id === "invoices")).toBe(true);
    expect(searchGuideSections(sections, "not-a-kairo-topic")).toEqual([]);
  });

  it("keeps the permissions matrix aligned to all canonical roles", () => {
    const payload = buildUserGuidePayload({ name: "Finance", role: "Finance Admin" });
    for (const row of payload.permissionMatrix) {
      expect(Object.keys(row.permissions).sort()).toEqual(
        ["Employee", "Manager", "Admin", "Finance Admin", "Super Admin"].sort(),
      );
    }
  });
});

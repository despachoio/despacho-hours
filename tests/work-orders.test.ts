import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { canAccessWorkOrders } from "@/lib/roles";
import {
  canTransitionWorkOrder,
  customerIdForSequence,
  workOrderNumber,
} from "@/lib/work-orders/access";

const root = process.cwd();
describe("Work Order authorization", () => {
  it.each([
    ["Finance Admin", true],
    ["Super Admin", true],
    ["Admin", false],
    ["Manager", false],
    ["Employee", false],
  ])("enforces %s", (role, allowed) =>
    expect(canAccessWorkOrders(role)).toBe(allowed),
  );
  it("guards direct API and PDF access before returning data", () => {
    const api = readFileSync(
      resolve(root, "src/app/api/work-orders/route.ts"),
      "utf8",
    );
    const pdf = readFileSync(
      resolve(root, "src/app/api/work-orders/[id]/pdf/route.tsx"),
      "utf8",
    );
    const get = api.slice(
      api.indexOf("export async function GET"),
      api.indexOf("export async function POST"),
    );
    expect(get.indexOf("await workOrderActor(request)")).toBeGreaterThan(-1);
    expect(get.indexOf("await workOrderActor(request)")).toBeLessThan(
      get.indexOf("searchWorkOrders(request"),
    );
    expect(pdf).toContain("await workOrderActor(request)");
  });
  it("enforces database RLS for all Work Order tables", () => {
    const sql = readFileSync(
      resolve(root, "supabase/migrations/202608240001_work_orders.sql"),
      "utf8",
    );
    expect(sql).toContain(
      "get_my_actual_role() in ('finance admin','super admin')",
    );
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("reserve_work_order_identity");
    expect(sql).toContain("pg_advisory_xact_lock");
  });
});
describe("Work Order identity", () => {
  it("keeps the approved Work Order to Customer relationship", () => {
    expect(workOrderNumber(93)).toBe("0093");
    expect(customerIdForSequence(93)).toBe(1093);
    expect(workOrderNumber(95)).toBe("0095");
    expect(customerIdForSequence(95)).toBe(1095);
  });
});
describe("Work Order lifecycle", () => {
  it("allows the forward lifecycle", () => {
    expect(canTransitionWorkOrder("draft", "generated")).toBe(true);
    expect(canTransitionWorkOrder("generated", "sent")).toBe(true);
    expect(canTransitionWorkOrder("sent", "signed")).toBe(true);
    expect(canTransitionWorkOrder("signed", "onboarded")).toBe(true);
  });
  it("blocks backward and post-signature mutation", () => {
    expect(canTransitionWorkOrder("signed", "draft")).toBe(false);
    expect(canTransitionWorkOrder("onboarded", "generated")).toBe(false);
    expect(canTransitionWorkOrder("cancelled", "draft")).toBe(false);
  });
});

describe("Work Order document and workspace", () => {
  it("uses dynamic customer and effective-date placeholders in approved terms", () => {
    const sql = readFileSync(
      resolve(
        root,
        "supabase/migrations/202608240002_approved_work_order_terms.sql",
      ),
      "utf8",
    );
    expect(sql).toContain("{{EFFECTIVE_DATE}}");
    expect(sql).toContain("{{CUSTOMER_NAME}}");
    expect(sql).not.toContain("The Red Life");
  });

  it("provides lifecycle, revision, onboarding, and PDF actions", () => {
    const workspace = readFileSync(
      resolve(root, "src/components/work-orders/WorkOrdersWorkspace.tsx"),
      "utf8",
    );
    expect(workspace).toContain("Mark Sent");
    expect(workspace).toContain("Mark Signed");
    expect(workspace).toContain("Create Revision");
    expect(workspace).toContain("Create or Link Client");
    expect(workspace).toContain("Create Project");
    expect(workspace).toContain("Download PDF");
  });

  it("keeps generated versions immutable and signed commercial data protected", () => {
    const sql = readFileSync(
      resolve(root, "supabase/migrations/202608240001_work_orders.sql"),
      "utf8",
    );
    expect(sql).toContain("Generated Work Order versions are immutable");
    expect(sql).toContain(
      "Signed Work Order commercial and customer terms are immutable",
    );
  });
});

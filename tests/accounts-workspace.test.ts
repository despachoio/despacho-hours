import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("Accounts navigation architecture", () => {
  const layout = read("src/app/(app)/layout.tsx");
  const accounts = read("src/app/(app)/accounts/page.tsx");
  const clients = read("src/app/(app)/clients/page.tsx");
  const projects = read("src/app/(app)/projects/page.tsx");

  it("uses the consolidated sidebar order", () => {
    const expectedOrder = [
      "Dashboard",
      "Time",
      "Workforce",
      "Time Off",
      "Payroll",
      "Invoices",
      "Accounts",
      "Settings",
    ];
    const positions = expectedOrder.map((name) =>
      layout.indexOf(`name: "${name}"`),
    );

    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(layout).not.toContain('name: "Clients"');
    expect(layout).not.toContain('name: "Projects"');
  });

  it("places the embedded new-project action beside its section heading", () => {
    expect(projects).toContain("sm:flex-row sm:items-end sm:justify-between");
    expect(projects).toContain("sm:self-auto");
  });

  it("supports client and project tabs without loading both at once", () => {
    expect(accounts).toContain('{ value: "clients", label: "Clients" }');
    expect(accounts).toContain('{ value: "projects", label: "Projects" }');
    expect(accounts).toContain('router.replace(tab === "clients" ? "/accounts" : "/accounts?tab=projects"');
    expect(accounts).toContain("<ClientsWorkspace embedded />");
    expect(accounts).toContain("<ProjectsWorkspace embedded />");
  });

  it("retains the legacy pages as working route aliases", () => {
    expect(clients).toContain("return <ClientsWorkspace />;");
    expect(projects).toContain("return <ProjectsWorkspace />;");
    expect(clients).toContain("href={`/clients/${client.id}`}");
    expect(projects).toContain('href="/projects/new"');
    expect(layout).toContain("const legacyRouteAccess");
    expect(layout).toContain('path: "/clients"');
  });
});

describe("New workforce member cancellation", () => {
  const workforce = read("src/app/(app)/team/page.tsx");

  it("offers both close and cancel controls that clear the form", () => {
    expect(workforce).toContain("function closeNewMemberForm()");
    expect(workforce).toContain('aria-label="Close new workforce member form"');
    expect(workforce).toContain("onClick={closeNewMemberForm}");
    expect(workforce).toContain("Cancel");
    expect(workforce).toContain("setMemberDraft(emptyEmployeeProfileChanges())");
  });
});

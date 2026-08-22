import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(path, "utf8");

const moduleLayouts = [
  ["Dashboard", "src/app/(app)/dashboard/layout.tsx"],
  ["Time", "src/app/(app)/timer/layout.tsx"],
  ["Workforce", "src/app/(app)/team/layout.tsx"],
  ["Time Off", "src/app/(app)/time-off/layout.tsx"],
  ["Payroll", "src/app/(app)/payroll/layout.tsx"],
  ["Invoices", "src/app/(app)/invoices/layout.tsx"],
  ["Accounts", "src/app/(app)/accounts/layout.tsx"],
  ["Settings", "src/app/(app)/settings/layout.tsx"],
] as const;

describe("Kairo App Router page metadata", () => {
  it("centralizes the Kairo suffix and preserves a bare root fallback", () => {
    const root = source("src/app/layout.tsx");
    expect(root).toContain('default: "Kairo"');
    expect(root).toContain('template: "%s | Kairo"');
  });

  it.each(moduleLayouts)("gives %s its top-level module title", (title, path) => {
    const layout = source(path);
    expect(layout).toContain(`title: "${title}"`);
    expect(layout).not.toContain(`${title} | Kairo`);
  });

  it("keeps query-controlled Workforce and Payroll tabs under module layouts", () => {
    const workforce = source("src/app/(app)/team/page.tsx");
    const payroll = source("src/components/payroll/PayrollWorkspace.tsx");
    expect(workforce).toContain("useSearchParams");
    expect(payroll).toContain('useState<Tab>("overview")');
    expect(source("src/app/(app)/team/layout.tsx")).toContain('title: "Workforce"');
    expect(source("src/app/(app)/payroll/layout.tsx")).toContain('title: "Payroll"');
  });

  it("keeps legacy client and project detail routes in Accounts", () => {
    expect(source("src/app/(app)/clients/layout.tsx")).toContain('title: "Accounts"');
    expect(source("src/app/(app)/projects/layout.tsx")).toContain('title: "Accounts"');
  });

  it("provides meaningful titles for supporting authenticated and auth routes", () => {
    const expected = [
      ["Reports", "src/app/(app)/reports/layout.tsx"],
      ["My Profile", "src/app/(app)/profile/layout.tsx"],
      ["Login", "src/app/login/layout.tsx"],
      ["Forgot Password", "src/app/forgot-password/layout.tsx"],
      ["Reset Password", "src/app/reset-password/layout.tsx"],
      ["Update Password", "src/app/auth/update-password/layout.tsx"],
      ["Signing In", "src/app/auth/callback/layout.tsx"],
      ["Desktop Timer", "src/app/desktop-timer/layout.tsx"],
      ["Invoice Payment", "src/app/pay/invoice/[token]/layout.tsx"],
    ] as const;
    for (const [title, path] of expected) {
      expect(source(path)).toContain(`title: "${title}"`);
    }
  });

  it("does not manually duplicate the centralized suffix", () => {
    for (const [, path] of moduleLayouts) {
      expect(source(path)).not.toMatch(/title:\s*["'][^"']*\| Kairo/);
    }
  });
});

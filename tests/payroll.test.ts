import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { calculatePayroll, payrollPeriod } from "../src/lib/payroll/calculation";

const source = (path: string) => readFileSync(path, "utf8");

describe("Payroll calculation engine", () => {
  it("calculates automatic earnings and statutory contributions", () => {
    const value = calculatePayroll({ grossSalary: 50_000, periodDays: 30 });
    expect(value.basicPay).toBe(25_000);
    expect(value.hra).toBe(10_000);
    expect(value.conveyanceAllowance).toBe(1_600);
    expect(value.otherAllowance).toBe(13_400);
    expect(value.epfSalary).toBe(15_000);
    expect(value.employeePf).toBe(1_800);
    expect(value.employerEps).toBe(1_249.5);
    expect(value.employerPf).toBe(550.5);
    expect(value.employerTotalContribution).toBe(1_800);
    expect(value.professionalTax).toBe(200);
    expect(value.netSalary).toBe(48_000);
  });

  it("keeps LOP based only on gross salary", () => {
    const value = calculatePayroll({ grossSalary: 30_000, periodDays: 30, lopDays: 1.5, bonus: 10_000, leaveEncashment: 5_000, reimbursements: 2_000 });
    expect(value.lopRecommended).toBe(1_500);
    expect(value.totalEarnings).toBe(47_000);
  });

  it("uses the configurable 26th to 25th payroll period", () => {
    expect(payrollPeriod("2026-07-01", 26, 25)).toEqual({ start: "2026-06-26", end: "2026-07-25", days: 30 });
  });
});

describe("Payroll security and snapshot contracts", () => {
  const migration = source("supabase/migrations/202608020001_payroll_module.sql");
  it("limits administration to Finance Admin and employees to their published snapshots", () => {
    expect(migration).toContain("public.get_my_actual_role() = 'finance admin'");
    expect(migration).toContain("employee_id = public.get_my_employee_id() and published_at is not null and status = 'published'");
    expect(migration).not.toContain("super admin'\n");
  });
  it("stores every required payslip snapshot component", () => {
    for (const column of ["gross_salary","basic_pay","hra","conveyance_allowance","other_allowance","bonus","leave_encashment","employee_pf","employer_pf","employer_eps","professional_tax","lop_deduction","previous_month_adjustment","tds","net_salary","salary_structure_version"]) expect(migration).toContain(column);
  });
  it("provides employee PDF and Finance Admin workflow surfaces", () => {
    expect(source("src/components/payroll/PayrollWorkspace.tsx")).toContain("Salary Register");
    expect(source("src/components/payroll/PayrollWorkspace.tsx")).toContain("Download Salary Slip");
    expect(source("src/app/api/payroll/payslip/[id]/route.ts")).toContain("entry.employee_id !== actor.employeeId");
  });

  it("renders a premium employee payslip without internal payroll details", () => {
    const payslip = source("src/components/payroll/PayslipPdfDocument.tsx");
    expect(payslip).toContain("PAYSLIP");
    expect(payslip).toContain("EMPLOYEE INFORMATION");
    expect(payslip).toContain("EARNINGS &amp; DEDUCTIONS");
    expect(payslip).toContain("Effective Working Days");
    expect(payslip).toContain("System-generated payslip. No signature is required.");
    expect(payslip).not.toContain("SALARY SLIP");
    expect(payslip).not.toContain("Employer contribution");
    expect(payslip).not.toContain("Employer PF");
    expect(payslip).not.toContain("Employer EPS");
    expect(payslip).not.toContain("INR ");
    expect(payslip).not.toContain("period_start} to {entry.period_end");
  });

  it("uses the bundled Despacho logo and restores the INR currency footer", () => {
    const route = source("src/app/api/payroll/payslip/[id]/route.ts");
    const payslip = source("src/components/payroll/PayslipPdfDocument.tsx");
    expect(route).toContain('invoice_logo_url: "/despacho-logo-full.png"');
    expect(route).not.toContain("kairo-logo");
    expect(payslip).toContain("All amounts are in INR");
    expect(payslip).not.toContain("kairo-logo");
  });

  it("matches the approved corporate payslip structure", () => {
    const payslip = source("src/components/payroll/PayslipPdfDocument.tsx");
    for (const content of ["Great People. Great Impact.", "EMPLOYEE INFORMATION", "EARNINGS &amp; DEDUCTIONS", "GROSS EARNINGS", "TOTAL DEDUCTIONS", "NET SALARY"]) {
      expect(payslip).toContain(content);
    }
    expect(payslip).toContain("styles.payrollHeaderCellRight");
    expect(payslip).toContain("styles.summaryDivider");
  });
});

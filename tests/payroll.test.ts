import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { calculatePayroll, payrollPeriod } from "../src/lib/payroll/calculation";
import { toPayrollEntryDto } from "../src/lib/payroll/entry";
import { currentFinancialYear, financialYearForPayrollMonth, financialYearFromValue, financialYearOptions, isInFinancialYear } from "../src/lib/payroll/financialYear";
import { payslipFilename, ytdFilename } from "../src/lib/payroll/filenames";
import { MANUAL_PAYROLL_FIELDS, PAYROLL_LABELS } from "../src/lib/payroll/labels";
import { normalizePayrollNumber } from "../src/lib/payroll/numbers";
import { canApprovePayroll, canEditPayroll, canExportPayroll, canSubmitPayroll, payrollLifecycleStatus } from "../src/lib/payroll/lifecycle";
import { buildBankTransferFile, salaryRegisterHeaders, salaryRegisterRows, stripEmployeeTitle, summarizePayroll } from "../src/lib/payroll/exports";
import { calculateSalaryStructure, latestSalaryStructure, salaryStructureDisplayStatus, selectEffectiveSalaryStructures } from "../src/lib/payroll/salaryStructures";
import type { SalaryStructure } from "../src/lib/payroll/types";

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
    expect(value.employerEps).toBe(1_250);
    expect(value.employerPf).toBe(550);
    expect(value.employerTotalContribution).toBe(1_800);
    expect(value.professionalTax).toBe(200);
    expect(value.netSalary).toBe(48_000);
  });

  it("keeps LOP based only on gross salary", () => {
    const value = calculatePayroll({ grossSalary: 30_000, periodDays: 30, lopDays: 1.5, bonus: 10_000, leaveEncashment: 5_000 });
    expect(value.lopRecommended).toBe(1_500);
    expect(value.totalEarnings).toBe(45_000);
  });

  it("excludes the legacy reimbursement value from historical DTO totals", () => {
    const entry = toPayrollEntryDto({
      gross_salary: 30_000,
      bonus: 1_000,
      leave_encashment: 500,
      reimbursements: 2_000,
      total_earnings: 33_500,
      total_deductions: 2_500,
      net_salary: 31_000,
    });

    expect(entry).not.toHaveProperty("reimbursements");
    expect(entry.total_earnings).toBe(31_500);
    expect(entry.net_salary).toBe(29_000);
  });

  it("normalizes blank payroll drafts only at calculation boundaries", () => {
    expect(normalizePayrollNumber("")).toBe(0);
    expect(normalizePayrollNumber(null)).toBe(0);
    expect(normalizePayrollNumber(undefined)).toBe(0);
    expect(normalizePayrollNumber("0")).toBe(0);
    expect(normalizePayrollNumber("1250")).toBe(1_250);
    expect(normalizePayrollNumber(1_250)).toBe(1_250);
    expect(normalizePayrollNumber("not-a-number")).toBe(0);
    expect(normalizePayrollNumber(-250)).toBe(-250);
  });

  it("uses the configurable 26th to 25th payroll period", () => {
    expect(payrollPeriod("2026-07-01", 26, 25)).toEqual({ start: "2026-06-26", end: "2026-07-25", days: 30 });
  });

  it("auto-calculates complete salary structure components with existing payroll rules", () => {
    expect(calculateSalaryStructure(16_800)).toEqual({ gross_salary: 16_800, basic_pay: 15_000, hra: 0, conveyance_allowance: 1_600, other_allowance: 200, epf_salary: 15_000, employee_pf: 1_800, employer_pf: 550, employer_eps: 1_250 });
    expect(calculateSalaryStructure(30_000)).toEqual({ gross_salary: 30_000, basic_pay: 15_000, hra: 6_000, conveyance_allowance: 1_600, other_allowance: 7_400, epf_salary: 15_000, employee_pf: 1_800, employer_pf: 550, employer_eps: 1_250 });
  });

  it("honours manually overridden salary components without changing deduction rules", () => {
    const value = calculatePayroll({ grossSalary: 30_000, basicPay: 14_000, hra: 5_000, conveyanceAllowance: 2_000, otherAllowance: 9_000, epfSalary: 14_000, employeePf: 1_680, employerEps: 1_166, employerPf: 514, periodDays: 30 });
    expect(value.basicPay).toBe(14_000);
    expect(value.otherAllowance).toBe(9_000);
    expect(value.employeePf).toBe(1_680);
    expect(value.employerPf).toBe(514);
  });
});

describe("Effective-dated salary structure selection", () => {
  const structures: Array<{ id: string; employee_id: string; version: number; effective_from: string }> = [
    { id: "april", employee_id: "employee-1", version: 1, effective_from: "2026-04-01" },
    { id: "june", employee_id: "employee-1", version: 2, effective_from: "2026-06-01" },
    { id: "future", employee_id: "employee-2", version: 1, effective_from: "2026-09-01" },
  ];

  it("uses the 01 April structure for May payroll", () => {
    expect(selectEffectiveSalaryStructures(structures, "2026-05-01").find((item) => item.employee_id === "employee-1")?.id).toBe("april");
  });

  it("uses the 01 June structure for June and later payroll", () => {
    expect(selectEffectiveSalaryStructures(structures, "2026-06-01").find((item) => item.employee_id === "employee-1")?.id).toBe("june");
  });

  it("derives active, scheduled, and historical status from effective dates", () => {
    const allStructures = structures as unknown as SalaryStructure[];
    const employeeStructures = allStructures.filter((item) => item.employee_id === "employee-1");
    expect(salaryStructureDisplayStatus(allStructures[1], employeeStructures, "2026-07-01")).toBe("active");
    expect(salaryStructureDisplayStatus(allStructures[0], employeeStructures, "2026-07-01")).toBe("historical");
    expect(salaryStructureDisplayStatus(allStructures[2], allStructures, "2026-07-01")).toBe("scheduled");
    expect(latestSalaryStructure(employeeStructures)?.id).toBe("june");
  });
});

describe("Payroll financial year", () => {
  it("uses April through March without changing monthly payroll values", () => {
    const financialYear = currentFinancialYear(new Date(2026, 7, 2));
    expect(financialYear.value).toBe("2026-27");
    expect(financialYear.label).toBe("2026\u201327");
    expect(financialYear.months[0]).toBe("2026-04");
    expect(financialYear.months[11]).toBe("2027-03");
    expect(financialYearForPayrollMonth("2027-03-01").value).toBe("2026-27");
    expect(financialYearForPayrollMonth("2027-04-01").value).toBe("2027-28");
    expect(isInFinancialYear("2026-07-01", financialYear.value)).toBe(true);
    expect(isInFinancialYear("2027-04-01", financialYear.value)).toBe(false);
    expect(financialYearFromValue("2026-28")).toBeNull();
  });

  it("uses employee-friendly payroll download filenames", () => {
    expect(payslipFilename("90001", "2026-07")).toBe("Payslip_90001_July 2026.pdf");
    expect(ytdFilename("90001", "2026-27")).toBe("YTD_90001_FY 2026-27.pdf");
  });

  it("lists financial years continuously from the current year to the oldest payroll year", () => {
    const current = currentFinancialYear(new Date(2026, 7, 2));
    expect(financialYearOptions(["2024-07"], current).map((year) => year.value)).toEqual(["2026-27", "2025-26", "2024-25"]);
  });
});

describe("Payroll security and snapshot contracts", () => {
  const migration = source("supabase/migrations/202608020001_payroll_module.sql");
  const lifecycleMigration = source("supabase/migrations/202608090001_payroll_admin_lifecycle.sql");
  const bankTransferMigration = source("supabase/migrations/202608090002_payroll_bank_transfer_details.sql");
  const salaryVersionMigration = source("supabase/migrations/202608090003_salary_structure_effective_versions.sql");
  it("allows Finance Admin, Super Admin, and Admin administration while employees retain published snapshots", () => {
    expect(migration).toContain("public.get_my_actual_role() = 'finance admin'");
    expect(migration).toContain("employee_id = public.get_my_employee_id() and published_at is not null and status = 'published'");
    expect(lifecycleMigration).toContain("('finance admin', 'super admin', 'admin')");
    expect(lifecycleMigration).toContain("payroll_runs_admin_all");
    expect(lifecycleMigration).toContain("payroll_entries_admin_all");
  });
  it("stores every required payslip snapshot component", () => {
    for (const column of ["gross_salary","basic_pay","hra","conveyance_allowance","other_allowance","bonus","leave_encashment","employee_pf","employer_pf","employer_eps","professional_tax","lop_deduction","previous_month_adjustment","tds","net_salary","salary_structure_version"]) expect(migration).toContain(column);
    expect(migration).toContain("reimbursements numeric(14,2) not null default 0");
  });
  it("provides employee PDF and payroll administration workflow surfaces", () => {
    const workspace = source("src/components/payroll/PayrollWorkspace.tsx");
    expect(workspace).toContain("Download Payslip");
    expect(workspace).toContain('setTab("administration")');
    expect(workspace).toContain('aria-label="Payroll administration sections"');
    for (const section of ["Payroll Dashboard", "Salary Structures", "Payroll Processing", "Reports", "Settings"]) expect(workspace).toContain(section);
    expect(workspace).not.toContain('["register", "Salary Register"]');
    expect(source("src/app/api/payroll/payslip/[id]/route.ts")).toContain("entry.employee_id !== actor.employeeId");
  });

  it("implements the Generated, Approved, Submitted lifecycle", () => {
    expect(payrollLifecycleStatus("draft")).toBe("generated");
    expect(payrollLifecycleStatus("under_review")).toBe("generated");
    expect(payrollLifecycleStatus("approved")).toBe("approved");
    expect(payrollLifecycleStatus("locked")).toBe("approved");
    expect(payrollLifecycleStatus("published")).toBe("submitted");
    expect(canEditPayroll("draft")).toBe(true);
    expect(canApprovePayroll("draft")).toBe(true);
    expect(canExportPayroll("draft")).toBe(false);
    expect(canSubmitPayroll("approved")).toBe(true);
    expect(canEditPayroll("published")).toBe(false);
  });

  it("keeps the register inside Payroll Processing and removes standalone register exports", () => {
    const administration = source("src/components/payroll/PayrollAdministration.tsx");
    expect(administration).toContain("Generate Payroll");
    expect(administration).toContain("Reprocess Payroll");
    expect(administration).toContain("Approve Payroll");
    expect(administration).toContain("Submit Payroll");
    expect(administration).toContain("Cancel Payroll");
    expect(administration).toContain("Salary Register");
    expect(administration).toContain("Download Salary Register");
    expect(administration).toContain("Export Bank Transfer File");
    expect(administration).toContain("editable={canEditPayroll(run.status)}");
  });

  it("captures a processing date before payroll generation", () => {
    const administration = source("src/components/payroll/PayrollAdministration.tsx");
    const route = source("src/app/api/payroll/route.ts");
    const server = source("src/lib/payroll/server.ts");
    expect(administration).toContain("Payroll Processing Date");
    expect(administration).toContain("payrollMonth: month, processingDate");
    expect(route).toContain('String(body.processingDate || "")');
    expect(server).toContain("processing_date: processingDate(requestedProcessingDate");
    expect(bankTransferMigration).toContain("add column if not exists processing_date date");
    expect(bankTransferMigration).toContain("alter column processing_date set not null");
  });

  it("adds protected company payroll bank settings", () => {
    const settingsPage = source("src/app/(app)/settings/page.tsx");
    const settingsRoute = source("src/app/api/settings/company/route.ts");
    for (const field of ["payroll_bank_customer_id", "payroll_bank_account_number", "payroll_bank_ifsc_code"]) {
      expect(settingsPage).toContain(field);
      expect(settingsRoute).toContain(field);
      expect(bankTransferMigration).toContain(field);
    }
    expect(settingsPage).toContain("Payroll bank account");
  });

  it("exports the bank-enriched salary register without titles or department", () => {
    expect(salaryRegisterHeaders).toEqual([
      "Employee Code", "Employee Name", "Bank Name", "IFSC Code", "Bank Account Number",
      "Bonus", "Leave Encashment", "Gross Pay", "PT", "LOP", "Adjustment", "TDS", "Net Pay",
    ]);
    expect(stripEmployeeTitle("Mrs. Riya Kumar")).toBe("Riya Kumar");
    const run = {
      payroll_month: "2026-08-01",
      processing_date: "2026-08-25",
      net_payroll: 48_000,
      entries: [{ employee_id: "employee-1", employee_code: "90001", employee_name: "Mr. Ajay Kumar", bonus: 0, leave_encashment: 0, gross_salary: 50_000, professional_tax: 200, lop_deduction: 0, previous_month_adjustment: 0, tds: 0, net_salary: 48_000 }],
    } as never;
    const bankDetails = [{ employee_id: "employee-1", bank_name: "ICICI Bank", ifsc_code: "ICIC0001234", bank_account_number: "1234567890" }];
    expect(salaryRegisterRows(run, bankDetails)[0].slice(0, 5)).toEqual(["90001", "Ajay Kumar", "ICICI Bank", "ICIC0001234", "1234567890"]);
    expect(salaryRegisterHeaders).not.toContain("Department");
    expect(salaryRegisterHeaders).not.toContain("Previous Month Adjustment");
  });

  it("builds a bank transfer file from the payroll date and company debit account", () => {
    const content = buildBankTransferFile({
      payroll_month: "2026-08-01",
      processing_date: "2026-08-25",
      net_payroll: 48_000,
      entries: [{ employee_id: "employee-1", employee_code: "90001", employee_name: "Ms. Riya Kumar", net_salary: 48_000 }],
    } as never, [{ employee_id: "employee-1", bank_name: "HDFC Bank", ifsc_code: "HDFC0001234", bank_account_number: "1234567890" }], {
      payroll_bank_customer_id: "CUST-01",
      payroll_bank_account_number: "9876543210",
      payroll_bank_ifsc_code: "ICIC0000001",
    });
    expect(content).toContain("Customer ID\tCUST-01");
    expect(content).toContain("Processing Date\t2026-08-25");
    expect(content).toContain("90001\tRiya Kumar\tHDFC Bank\t1234567890\tHDFC0001234\t48000");
  });

  it("reprocesses with manual adjustments and cancellation deletes only the payroll run", () => {
    const server = source("src/lib/payroll/server.ts");
    expect(server).toContain("preserveManualAdjustments");
    expect(server).toContain("manualByEmployee");
    expect(server).toContain('"payroll_reprocessed" : "payroll_generated"');
    expect(server).toContain('.from("payroll_runs").delete().eq("id", runId)');
    expect(server).not.toContain('to: "draft" } }');
  });

  it("provides the Finance-only salary structure search and history workflow", () => {
    const workspace = source("src/components/payroll/PayrollWorkspace.tsx");
    const structures = source("src/components/payroll/SalaryStructures.tsx");
    expect(workspace).toContain('value !== "structures" || salaryStructureAccess');
    expect(workspace).toContain("isFinanceAdminRole");
    for (const label of ["Add Salary Structure", "Select active employee", "Search", "Reset", "Salary Structure History", "Effective Date", "Monthly Gross Salary", "Basic Pay", "HRA", "Conveyance Allowance", "Other Allowance", "EPF Salary", "Employee PF", "Employer PF", "Employer EPS", "Created At"]) expect(structures).toContain(label);
    expect(structures).toContain("setAppliedEmployeeId(selectedEmployeeId)");
    expect(structures).toContain("No salary structure exists for this employee.");
  });

  it("supports create, latest-only edit/delete, duplicate, and recalculate dialogs", () => {
    const structures = source("src/components/payroll/SalaryStructures.tsx");
    const route = source("src/app/api/payroll/route.ts");
    const server = source("src/lib/payroll/server.ts");
    for (const action of ["create_structure", "update_structure", "duplicate_structure", "delete_structure"]) {
      expect(structures).toContain(action);
      expect(route).toContain(action);
    }
    expect(structures).toContain("Recalculate from Gross Salary");
    expect(structures).toContain('state.mode === "duplicate" ? ""');
    expect(structures).toContain("Deleting this version will reactivate the previous salary structure.");
    expect(server).toContain("Only the latest salary structure version can be edited.");
    expect(server).toContain("Only the latest salary structure version can be deleted.");
    expect(server).toContain("At least one salary structure must remain for this employee.");
  });

  it("enforces duplicate-date and processed-payroll protection on the server", () => {
    const server = source("src/lib/payroll/server.ts");
    expect(server).toContain("financePayrollOnly(actor.role)");
    expect(server).toContain("A salary structure already exists for this employee with this effective date.");
    expect(server).toContain("Payroll has already been processed for a period affected by this effective date. Please choose a later effective date.");
    expect(server).toContain('.from("payroll_runs").select("id").gte("payroll_month", affectedMonth)');
    expect(server).toContain('.eq("salary_structure_id", structureId)');
    expect(server).toContain("Salary components must contain valid non-negative values.");
  });

  it("stores full component versions, refreshes timelines, and restores Finance-only RLS", () => {
    for (const column of ["basic_pay", "hra", "conveyance_allowance", "other_allowance", "epf_salary", "employee_pf", "employer_pf", "employer_eps"]) expect(salaryVersionMigration).toContain(column);
    expect(salaryVersionMigration).toContain("salary_structures_employee_effective_unique_idx");
    expect(salaryVersionMigration).toContain("salary_structures_employee_effective_lookup_idx");
    expect(salaryVersionMigration).toContain("refresh_salary_structure_timeline");
    expect(salaryVersionMigration).toContain("lead(effective_from)");
    expect(salaryVersionMigration).toContain("effective_from <= current_date");
    expect(salaryVersionMigration).toContain("salary_structures_finance_all");
    expect(salaryVersionMigration).toContain("public.get_my_actual_role() = 'finance admin'");
  });

  it("selects structures by payroll-month applicability and preserves generated snapshots", () => {
    const server = source("src/lib/payroll/server.ts");
    expect(server).toContain('.lte("effective_from", month)');
    expect(server).toContain("selectEffectiveSalaryStructures(structureCandidates.data || [], month)");
    expect(server).not.toContain('.eq("is_active", true).eq("employees.status", "active")');
    expect(server).toContain("salary_structure_id: structure.id");
    expect(server).toContain("salary_structure_version: structure.version");
    expect(server).toContain("basicPay: Number(structure.basic_pay)");
    expect(source("supabase/migrations/202608020001_payroll_module.sql")).toContain("Immutable payroll-month snapshots");
  });

  it("audits every salary structure mutation through the existing payroll audit log", () => {
    const server = source("src/lib/payroll/server.ts");
    for (const action of ["salary_structure_created", "salary_structure_edited", "salary_structure_duplicated", "salary_structure_deleted"]) expect(server).toContain(action);
    expect(server).toContain('admin.from("payroll_audit_log").insert');
  });

  it("builds employee and Finance payroll reporting surfaces", () => {
    const administration = source("src/components/payroll/PayrollAdministration.tsx");
    const ytdRoute = source("src/app/api/payroll/ytd/route.ts");
    const summaryRoute = source("src/app/api/payroll/reports/summary/route.ts");
    for (const label of ["Employee Payroll", "Financial Year", "From Month", "To Month", "All Employees", "Download Payslip", "Download YTD", "Payroll Summary", "Download Excel", "Download PDF"]) expect(administration).toContain(label);
    expect(ytdRoute).toContain("includedMonths");
    expect(ytdRoute).toContain("requestedEmployeeId");
    expect(summaryRoute).toContain("financePayrollOnly(actor.role)");
    expect(summaryRoute).toContain('format === "xlsx"');
    expect(summaryRoute).toContain("PayrollSummaryPdfDocument");
  });

  it("aggregates Finance payroll summary values without changing calculations", () => {
    const summary = summarizePayroll([{ employee_id: "one", basic_pay: 10, hra: 5, conveyance_allowance: 2, other_allowance: 3, bonus: 1, leave_encashment: 4, gross_salary: 20, employee_pf: 2, employer_pf: 1, employer_eps: 1, professional_tax: 1, lop_deduction: 2, previous_month_adjustment: 3, tds: 4, net_salary: 14 } as never]);
    expect(summary.employeesProcessed).toBe(1);
    expect(summary.grossPayroll).toBe(20);
    expect(summary.netPayroll).toBe(14);
    expect(summary.lop).toBe(2);
    expect(summary.tds).toBe(4);
  });

  it("requires a financial year search before showing payroll history", () => {
    const workspace = source("src/components/payroll/PayrollWorkspace.tsx");
    const history = workspace.slice(workspace.indexOf("function PayrollHistory"), workspace.indexOf("function Empty"));
    expect(history).toContain('const [searched, setSearched] = useState(false)');
    expect(history).toContain("Select a financial year and click Search");
    expect(history).toContain("Financial Year");
    expect(history).toContain("isInFinancialYear");
    expect(history).toContain("Month &amp; Year");
    expect(history).toContain("Gross Salary");
    expect(history).toContain("entry.gross_salary");
    expect(history).toContain("Deductions");
    expect(history).toContain("Net Salary");
    expect(history).toContain("Download PDF");
    expect(history).toContain("Download YTD");
    expect(history).toContain("Select Year");
    expect(history).toContain("Downloading...");
    expect(history).toContain("downloadingPayslipId");
    expect(history).toContain("downloadPayrollYtd");
    expect(history).toContain("table-fixed");
    expect(history).not.toContain("period_start");
    expect(history).not.toContain("period_end");
    expect(history).not.toContain("viewPayslip");
  });

  it("removes reimbursements and uses string-backed manual payroll inputs", () => {
    const workspace = source("src/components/payroll/PayrollWorkspace.tsx");
    const server = source("src/lib/payroll/server.ts");
    const route = source("src/app/api/payroll/route.ts");
    expect(workspace).not.toMatch(/reimbursements?/i);
    expect(server).not.toMatch(/reimbursements?/i);
    expect(route).not.toMatch(/reimbursements?/i);
    expect(workspace).toContain("value={form[key]}");
    expect(workspace).toContain("e.target.value");
    expect(workspace).not.toContain("Number(e.target.value)");
    expect(route).toContain("normalizePayrollNumber(body.bonus");
    expect(route).toContain("normalizePayrollNumber(body.lopDeduction");
    expect(MANUAL_PAYROLL_FIELDS.map((field) => field.label)).toEqual([
      "Bonus",
      "Leave Encashment",
      "LOP",
      "Previous Month Adjustment",
      "TDS",
    ]);
    expect(PAYROLL_LABELS).toEqual({ lop: "LOP", tds: "TDS" });
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
    expect(payslip).toContain('logo: { width: 138, height: 39');
    expect(payslip).toContain("fontSize: 12");
    expect(payslip).toContain('backgroundColor: "#153E90"');
    expect(payslip).not.toMatch(/reimbursements?/i);
    expect(payslip).not.toContain("LOP Deduction");
  });

  it("uses the bundled Despacho logo and restores the INR currency footer", () => {
    const route = source("src/app/api/payroll/payslip/[id]/route.ts");
    const payslip = source("src/components/payroll/PayslipPdfDocument.tsx");
    expect(route).toContain('invoice_logo_url: "/despacho-logo-full.png"');
    expect(route).not.toContain("kairo-logo");
    expect(payslip).toContain("All amounts are in Indian Rupees (INR)");
    expect(payslip).not.toContain("kairo-logo");
  });

  it("matches the approved corporate payslip structure", () => {
    const payslip = source("src/components/payroll/PayslipPdfDocument.tsx");
    for (const content of ["EMPLOYEE INFORMATION", "EARNINGS &amp; DEDUCTIONS", "GROSS SALARY", "TOTAL DEDUCTIONS", "NET SALARY"]) {
      expect(payslip).toContain(content);
    }
    expect(payslip).toContain("styles.payrollHeaderCellRight");
    expect(payslip).toContain("styles.summaryDivider");
  });

  it("generates a protected PDF YTD payroll statement", () => {
    const route = source("src/app/api/payroll/ytd/route.ts");
    const document = source("src/components/payroll/YtdPayrollPdfDocument.tsx");
    expect(route).toContain("payrollActor(request)");
    expect(route).toContain('Content-Type": "application/pdf"');
    expect(route).toContain('invoice_logo_url: "/despacho-logo-full.png"');
    expect(document).toContain('orientation="landscape"');
    expect(document).toContain("DESPACHO INDIA PRIVATE LIMITED");
    expect(document).toContain("YTD Summary for the Financial Year");
    expect(document).toContain("reportMonths.map");
    expect(document).toContain("ExecutiveInfoRow");
    expect(document).toContain("RupeeNotice");
    expect(document).toContain("All amounts are in Indian Rupees (INR)");
    expect(document).not.toContain("styles.infoCircle");
    expect(document).not.toContain("currencyRow");
    expect(document).toContain("styles.footerCurrency");
    expect(document).toContain("System-generated YTD payroll statement. No signature is required.");
    expect(document).toContain("styles.alternateRow");
    expect(document).toContain("GRAND TOTAL");
    expect(document).toContain("styles.itemHeaderText");
    expect(document).toContain("styles.grandHeaderText");
    expect(document).not.toContain('label="UAN"');
    expect(document).toContain('logo: { width: 130.5, height: 33.75');
    expect(document).toContain('earningsTotalRow: { minHeight: 19, backgroundColor: PRIMARY }');
    expect(document).toContain('deductionsTotalRow: { minHeight: 19, backgroundColor: "#FFF1F2" }');
    expect(document).not.toMatch(/reimbursements?/i);
    expect(document).not.toContain("LOP Deduction");
    expect(route).toContain("includedMonths[0]");
    expect(route).toContain("includedMonths.at(-1)");
    expect(route).toContain("ytdFilename");
    expect(source("src/app/api/payroll/payslip/[id]/route.ts")).toContain("payslipFilename");
  });
});

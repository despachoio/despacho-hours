export type PayrollStatus = "draft" | "under_review" | "approved" | "locked" | "published";

export type SalaryStructure = {
  id: string;
  employee_id: string;
  version: number;
  gross_salary: number;
  effective_from: string;
  effective_to: string | null;
  is_active: boolean;
  notes: string | null;
  employees?: { id: string; employee_code: string; name: string; title: string | null; department: string | null; status: string } | null;
};

export type PayrollEntry = {
  id: string;
  payroll_run_id: string;
  employee_id: string;
  employee_code: string;
  employee_name: string;
  department: string | null;
  payroll_month: string;
  period_start: string;
  period_end: string;
  gross_salary: number;
  basic_pay: number;
  hra: number;
  conveyance_allowance: number;
  other_allowance: number;
  bonus: number;
  leave_encashment: number;
  epf_salary: number;
  employee_pf: number;
  employer_pf: number;
  employer_eps: number;
  employer_total_contribution: number;
  professional_tax: number;
  lop_days: number;
  lop_recommended: number;
  lop_deduction: number;
  previous_month_adjustment: number;
  tds: number;
  total_earnings: number;
  total_deductions: number;
  net_salary: number;
  salary_structure_version: number;
  status: PayrollStatus;
  published_at: string | null;
  manual_notes: string | null;
};

export type PayrollRun = {
  id: string;
  payroll_month: string;
  period_start: string;
  period_end: string;
  status: PayrollStatus;
  employee_count: number;
  gross_payroll: number;
  net_payroll: number;
  employer_pf_total: number;
  employer_eps_total: number;
  cancellation_reason: string | null;
  entries?: PayrollEntry[];
};

export type PayrollSettings = {
  id: string;
  period_start_day: number;
  period_end_day: number;
  currency: string;
  professional_tax_threshold: number;
  professional_tax_amount: number;
  conveyance_allowance: number;
};

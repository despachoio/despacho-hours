export type PayrollStatus = "draft" | "under_review" | "approved" | "locked" | "published";

export type SalaryStructure = {
  id: string;
  employee_id: string;
  version: number;
  gross_salary: number;
  basic_pay: number;
  hra: number;
  conveyance_allowance: number;
  other_allowance: number;
  epf_salary: number;
  employee_pf: number;
  employer_pf: number;
  employer_eps: number;
  effective_from: string;
  effective_to: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
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
  recurring_adjustment_snapshot: RecurringAdjustmentSnapshot[];
  manual_override_fields: string[];
};

export type RecurringAdjustmentType = "earning" | "deduction";
export type RecurringAdjustmentComponent = "bonus" | "tds";

export type RecurringPayrollAdjustment = {
  id: string;
  employee_id: string;
  adjustment_type: RecurringAdjustmentType;
  component: RecurringAdjustmentComponent;
  amount: number;
  from_month: string;
  to_month: string | null;
  enabled: boolean;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
  employees?: { id: string; employee_code: string; name: string; title?: string | null; status: string } | null;
};

export type RecurringAdjustmentSnapshot = Pick<RecurringPayrollAdjustment, "id" | "adjustment_type" | "component" | "amount" | "from_month" | "to_month">;

export type PayrollRun = {
  id: string;
  payroll_month: string;
  processing_date: string;
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

export type EmployeeBankDetails = {
  employee_id: string;
  bank_name: string | null;
  ifsc_code: string | null;
  bank_account_number: string | null;
  branch_name?: string | null;
};

export type CompanyPayrollBankDetails = {
  payroll_bank_customer_id: string | null;
  payroll_bank_account_number: string | null;
  payroll_bank_ifsc_code: string | null;
  payroll_bank_branch_code: string | null;
  payroll_bank_currency: string | null;
};

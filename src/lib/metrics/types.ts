import type { EmployeeAnalytics } from "@/components/team/types";

export type TeamMetricFilters = {
  startDate: string;
  endDate: string;
  employeeId?: string;
  employeeStatus?: string;
  reportingManagerId?: string;
};

export type TeamMetrics = {
  employeeCount: number;
  currentlyWorkingCount: number;
  totalHoursLogged: number;
  totalBillableHours: number;
  totalExpectedHours: number;
  aggregateUtilization: number;
  averageEmployeeUtilization: number;
  projectsWorked: number;
  clientsServed: number;
  averageDailyHours: number;
  averageSessionHours: number;
  employees: EmployeeAnalytics[];
};

export type InvoiceMetricFilters = {
  year: number;
};

export type InvoiceMetricRow = {
  id: string;
  currency: string | null;
  total_amount: number | null;
  paid_amount: number | null;
  paid_at: string | null;
  status: string | null;
  issue_date: string | null;
  due_date: string | null;
};

export type InvoiceListRow = Omit<
  InvoiceMetricRow,
  "currency" | "total_amount" | "status" | "issue_date" | "due_date"
> & {
  invoice_number: number | null;
  client_id: string;
  currency: string;
  total_amount: number;
  status: string;
  issue_date: string;
  due_date: string;
  generated_from_recurring: boolean;
  clients: { name: string } | null;
};

export type OverdueInvoiceListFilters = {
  clientId?: string;
  currency?: string;
  issueDateFrom?: string;
  issueDateTo?: string;
  invoiceNumber?: number;
  clientIds?: string[];
};

export type CurrencyInvoiceSummary = {
  currency: string;
  openAmount: number;
  paidAmount: number;
  paidInYearAmount: number;
  overdueCount: number;
  overdueAmount: number;
  invoicesInYear: number;
};

export type InvoiceMetrics = {
  selectedYear: number;
  invoiceCount: number;
  overdueCount: number;
  currencies: CurrencyInvoiceSummary[];
};

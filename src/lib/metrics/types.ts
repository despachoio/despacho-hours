import type { EmployeeAnalytics } from "@/components/team/types";

export type TeamMetricFilters = {
  startDate: string;
  endDate: string;
  employeeId?: string;
  employeeStatus?: string;
};

export type TeamMetrics = {
  employeeCount: number;
  currentlyWorkingCount: number;
  totalHoursLogged: number;
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

export type CurrencyInvoiceSummary = {
  currency: string;
  openAmount: number;
  paidAmount: number;
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

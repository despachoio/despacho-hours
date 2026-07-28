export type ReportProfile = { role: string; employee_id: string | null };

export type ReportEntry = {
  id: string;
  employee_id: string;
  project_id: string;
  entry_date: string;
  started_at: string | null;
  stopped_at: string | null;
  hours: number;
  description: string | null;
  employees: { id: string; name: string; department: string | null } | null;
  projects: {
    id: string;
    name: string;
    project_code: string | null;
    remaining_hours: number;
    is_billable: boolean;
    clients: { id: string; name: string } | null;
  } | null;
};

export type LiveTimer = {
  id: string;
  employee_id: string;
  project_id: string;
  started_at: string;
  paused_at: string | null;
  total_paused_seconds: number;
  status: string;
  description: string | null;
  employees: { id: string; name: string } | null;
  projects: {
    id: string;
    name: string;
    project_code: string | null;
    is_billable: boolean;
    clients: { id: string; name: string } | null;
  } | null;
};

export type ReportFiltersValue = {
  employeeId: string;
  clientId: string;
  projectId: string;
  billingType: "all" | "billable" | "non_billable";
  datePreset: string;
  customFrom: string;
  customTo: string;
  status: "all" | "running" | "completed";
  search: string;
};

export type FilterOption = { id: string; name: string; code?: string | null };

export type AggregateRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  clientId: string;
  clientName: string;
  projectId: string;
  projectName: string;
  projectCode: string | null;
  totalHours: number;
  entries: number;
  averageSession: number;
  longestSession: number;
  utilisation: number;
  sourceEntries: ReportEntry[];
};

export type SummaryMetric = { label: string; value: string };
export type ChartDatum = { name: string; hours: number };
export type DailyDatum = { date: string; hours: number };

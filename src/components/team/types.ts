export type TeamProfile = { role: string; employee_id: string | null };

export type TeamEmployee = {
  id: string;
  employee_code: string | null;
  title: string | null;
  name: string;
  gender: string | null;
  email: string;
  role: string | null;
  level: string | null;
  department: string | null;
  date_of_joining: string | null;
  date_of_birth: string | null;
  epf_number: string | null;
  uan_number: string | null;
  reporting_manager_id: string | null;
  reporting_manager?: {
    id: string;
    name: string;
    title: string | null;
  } | null;
  status: string | null;
  hourly_cost?: number | null;
};

export type ReportingManagerOption = {
  id: string;
  name: string;
  access_role: string;
};

export type TeamEntry = {
  id: string;
  employee_id: string;
  project_id: string;
  entry_date: string;
  started_at: string | null;
  stopped_at: string | null;
  hours: number;
  description: string | null;
  projects: {
    id: string;
    name: string;
    project_code: string | null;
    is_billable: boolean;
    clients: { id: string; name: string } | null;
  } | null;
};

export type TeamTimer = {
  id: string;
  employee_id: string;
  project_id: string;
  started_at: string;
  paused_at: string | null;
  total_paused_seconds: number;
  status: string;
  description: string | null;
  projects: {
    id: string;
    name: string;
    project_code: string | null;
    clients: { id: string; name: string } | null;
  } | null;
};

export type EmployeeAnalytics = {
  employee: TeamEmployee;
  entries: TeamEntry[];
  timer: TeamTimer | null;
  hours: number;
  expectedHours: number;
  utilisation: number;
  billableHours: number;
  nonBillableHours: number;
  billableUtilisation: number;
  nonBillableUtilisation: number;
  projects: number;
  clients: number;
  averageDailyHours: number;
  averageSession: number;
  longestSession: number;
  entryCount?: number;
  projectIds?: string[];
  clientIds?: string[];
  status: "working" | "paused" | "offline" | "on_leave";
};

export type TeamFilterValue = {
  employeeId: string;
  status: string;
  department: string;
  period: string;
  customFrom: string;
  customTo: string;
  search: string;
};

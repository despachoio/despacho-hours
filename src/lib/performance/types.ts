export type PerformanceMetricCategory = "booster" | "penalty";
export type PerformanceReviewStatus = "draft" | "under_review" | "finalized" | "reopened";

export type UtilizationPolicy = {
  id?: string;
  level_group: "level_1" | "level_2" | "level_3_plus";
  expected_percent: number;
  monthly_expected_hours: number;
  quarterly_expected_hours: number;
  annual_expected_hours: number;
  minimum_percent: number;
  monthly_minimum_hours: number;
  quarterly_minimum_hours: number;
  annual_minimum_hours: number;
};

export type PerformanceMetric = {
  id: string; name: string; code: string; category: PerformanceMetricCategory;
  default_score_delta: number; requires_client: boolean; active: boolean;
  display_order: number; core_metric: boolean; qualification_rules: Record<string, unknown>;
};

export type PerformanceEvent = {
  id: string; employee_id: string; performance_year: number; metric_id: string;
  client_id: string | null; event_date: string; description: string;
  qualification_status: "qualified" | "not_qualified" | "pending";
  score_delta: number; evidence_url: string | null; notes: string | null;
  reason?: string | null; policy_category?: string | null; lost_client?: boolean;
  refund_amount?: number | null; source_type?: "manual" | "payroll"; source_id?: string | null;
  created_by: string | null; created_at: string; metric?: PerformanceMetric;
  client?: { id: string; name: string } | null; added_by_name?: string | null;
};

export type MonthlyUtilization = { month: number; label: string; expected: number; actual: number; percent: number; status: "expected" | "minimum" | "below_minimum" };
export type QuarterlyUtilization = { quarter: number; expected: number; actual: number; percent: number };
export type PerformanceCalculation = {
  policy: UtilizationPolicy; monthly: MonthlyUtilization[]; quarterly: QuarterlyUtilization[];
  annualExpected: number; annualActual: number; utilizationPercent: number;
  boosterScore: number; penaltyScore: number; overallScore: number; category: string;
  eligibility: "eligible" | "not_eligible" | "pending_review";
  eligibilityReasons: string[]; criticalFlags: string[];
  scoredEvents: Array<PerformanceEvent & { appliedScore: number; scoringReason: string }>;
};

export type PerformanceEmployee = {
  id: string; employee_code: string | null; name: string; department: string | null;
  role: string | null; level: string | null; reporting_manager_id: string | null;
  date_of_joining: string | null; date_of_birth: string | null; status: string | null;
  reporting_manager?: { id: string; name: string } | null;
};

export type PerformanceReview = {
  id: string; employee_id: string; performance_year: number; review_type: string;
  status: PerformanceReviewStatus; snapshot: Record<string, unknown> | null;
  finalized_at: string | null; finalized_by: string | null; reopened_at: string | null;
  started_at?: string | null; started_by?: string | null;
  reopen_reason: string | null; employee?: PerformanceEmployee;
  manager_decision?: string | null; hr_decision?: string | null;
};

export type PerformanceSettings = {
  id?: string; singleton_key: boolean; policy_version: number;
  eligibility_rules: Record<string, unknown>;
  performance_categories: Array<{ name: string; minimumScore: number }>;
};

export type PerformanceComment = { id: string; review_id: string; employee_id: string; performance_year: number; author_employee_id: string; author_role: string; comment_type: "manager" | "admin" | "employee"; comment: string; created_at: string; author_name?: string };

export type PerformanceData = {
  role: string; employeeId: string; year: number; canAdminister: boolean;
  employees: PerformanceEmployee[]; metrics: PerformanceMetric[]; policies: UtilizationPolicy[];
  events: PerformanceEvent[]; reviews: PerformanceReview[]; comments: PerformanceComment[];
  calculations: Record<string, PerformanceCalculation>;
  clients: Array<{id:string;name:string}>;
  settings: PerformanceSettings;
};

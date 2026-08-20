import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppraisalPolicyConfiguration } from "@/lib/team-policies";
import type { PerformanceMetric, PerformanceSettings, UtilizationPolicy } from "@/lib/performance/types";

const DEFAULT_SETTINGS: PerformanceSettings = {
  singleton_key: true,
  policy_version: 1,
  eligibility_rules: { minimumOverallScore: 80, maximumEscalations: 2 },
  performance_categories: [],
};

// Intentionally limited to three small configuration queries. This never loads
// employees, time entries, reviews, performance events, or calculated scores.
export async function loadAppraisalPolicyConfiguration(admin: SupabaseClient): Promise<AppraisalPolicyConfiguration> {
  const [policyResult, metricResult, settingsResult] = await Promise.all([
    admin.from("utilization_policies").select("level_group,expected_percent,monthly_expected_hours,quarterly_expected_hours,annual_expected_hours,minimum_percent,monthly_minimum_hours,quarterly_minimum_hours,annual_minimum_hours").order("level_group"),
    admin.from("performance_metric_definitions").select("id,name,code,category,default_score_delta,requires_client,active,display_order,core_metric,qualification_rules").eq("active", true).order("display_order"),
    admin.from("performance_settings").select("singleton_key,policy_version,eligibility_rules,performance_categories").eq("singleton_key", true).maybeSingle(),
  ]);
  const failure = policyResult.error || metricResult.error || settingsResult.error;
  if (failure) throw new Error(failure.message);
  return {
    policies: (policyResult.data || []) as UtilizationPolicy[],
    metrics: (metricResult.data || []) as PerformanceMetric[],
    settings: (settingsResult.data || DEFAULT_SETTINGS) as PerformanceSettings,
  };
}

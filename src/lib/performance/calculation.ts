import type { PerformanceCalculation, PerformanceEvent, PerformanceMetric, UtilizationPolicy } from "./types";

export const DEFAULT_UTILIZATION_POLICIES: UtilizationPolicy[] = [
  { level_group:"level_1", expected_percent:60, monthly_expected_hours:90, quarterly_expected_hours:270, annual_expected_hours:1080, minimum_percent:40, monthly_minimum_hours:60, quarterly_minimum_hours:180, annual_minimum_hours:720 },
  { level_group:"level_2", expected_percent:80, monthly_expected_hours:120, quarterly_expected_hours:360, annual_expected_hours:1440, minimum_percent:60, monthly_minimum_hours:90, quarterly_minimum_hours:270, annual_minimum_hours:1080 },
  { level_group:"level_3_plus", expected_percent:90, monthly_expected_hours:135, quarterly_expected_hours:405, annual_expected_hours:1620, minimum_percent:70, monthly_minimum_hours:105, quarterly_minimum_hours:315, annual_minimum_hours:1260 },
];

export function levelGroup(level: string | null): UtilizationPolicy["level_group"] {
  const value = Number(String(level || "").match(/\d+/)?.[0] || 1);
  return value >= 3 ? "level_3_plus" : value === 2 ? "level_2" : "level_1";
}

export function policyForLevel(level: string | null, policies = DEFAULT_UTILIZATION_POLICIES) {
  const group = levelGroup(level);
  return policies.find((item) => item.level_group === group) || DEFAULT_UTILIZATION_POLICIES.find((item) => item.level_group === group)!;
}

export function performanceCategory(score: number, categories?: Array<{name:string;minimumScore:number}>) {
  if(categories?.length)return [...categories].sort((a,b)=>b.minimumScore-a.minimumScore).find(item=>score>=item.minimumScore)?.name||"Not Eligible for Evaluation";
  if (score >= 150) return "Substantially Exceeded Expectations";
  if (score >= 125) return "Exceeded Expectations";
  if (score >= 100) return "Met Expectations";
  if (score >= 80) return "Partially Met Expectations";
  return "Not Eligible for Evaluation";
}

function countLabel(value:number){const words=["Zero","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten"];return words[value]??String(value);}

function appliedEventScores(events: PerformanceEvent[], metrics: PerformanceMetric[]) {
  const metricMap = new Map(metrics.map((metric) => [metric.id, metric]));
  const feedbackClients = new Set<string>();
  return [...events].sort((a,b)=>a.event_date.localeCompare(b.event_date)).map((event) => {
    const metric = event.metric || metricMap.get(event.metric_id);
    if (!metric) return { ...event, appliedScore: 0, scoringReason: "Metric unavailable" };
    const testimonialAsFeedback = metric.code === "client_testimonial" && event.qualification_status === "not_qualified";
    if (event.qualification_status !== "qualified" && !testimonialAsFeedback) return { ...event, metric, appliedScore: 0, scoringReason: "Not qualified" };
    let code = metric.code;
    if (testimonialAsFeedback) code = "client_feedback";
    if (code === "client_feedback") {
      const clientKey = event.client_id || `no-client:${event.id}`;
      if (feedbackClients.has(clientKey)) return { ...event, metric, appliedScore: 0, scoringReason: "Additional same-client feedback retained without duplicate score" };
      feedbackClients.add(clientKey);
    }
    const direction = metric.category === "penalty" ? -1 : 1;
    const score = testimonialAsFeedback ? 5 : Number(event.score_delta ?? metric.default_score_delta);
    return { ...event, metric, appliedScore: direction * Math.abs(score), scoringReason: testimonialAsFeedback ? "Non-publication testimonial scored as client feedback" : "Qualified" };
  });
}

export function calculatePerformance(input: { policy: UtilizationPolicy; monthlyBillableHours: number[]; events: PerformanceEvent[]; metrics: PerformanceMetric[]; reviewFinalized?: boolean; eligibilityRules?: Record<string,unknown>; performanceCategories?: Array<{name:string;minimumScore:number}> }): PerformanceCalculation {
  const { policy } = input;
  const monthly = Array.from({length:12}, (_, index) => {
    const actual = Number(input.monthlyBillableHours[index] || 0);
    const percent = policy.monthly_expected_hours ? actual / policy.monthly_expected_hours * 100 : 0;
    return { month:index + 1, label:new Date(Date.UTC(2026,index,1)).toLocaleString("en",{month:"short",timeZone:"UTC"}), expected:policy.monthly_expected_hours, actual, percent, status: actual >= policy.monthly_expected_hours ? "expected" as const : actual >= policy.monthly_minimum_hours ? "minimum" as const : "below_minimum" as const };
  });
  const quarterly = [0,1,2,3].map((quarter) => { const slice=monthly.slice(quarter*3,quarter*3+3); const actual=slice.reduce((sum,item)=>sum+item.actual,0); return { quarter:quarter+1, expected:policy.quarterly_expected_hours, actual, percent:policy.quarterly_expected_hours ? actual/policy.quarterly_expected_hours*100 : 0 }; });
  const annualActual = monthly.reduce((sum,item)=>sum+item.actual,0);
  const utilizationPercent = policy.annual_expected_hours ? annualActual/policy.annual_expected_hours*100 : 0;
  const scoredEvents = appliedEventScores(input.events, input.metrics);
  const boosterScore = scoredEvents.reduce((sum,item)=>sum+Math.max(item.appliedScore,0),0);
  const penaltyScore = scoredEvents.reduce((sum,item)=>sum+Math.abs(Math.min(item.appliedScore,0)),0);
  const overallScore = utilizationPercent + boosterScore - penaltyScore;
  const escalationCount = scoredEvents.filter((item)=>item.metric?.code === "client_escalation" && item.appliedScore < 0).length;
  const refundCount = scoredEvents.filter((item)=>item.metric?.code === "refund" && item.appliedScore < 0).length;
  const eligibilityReasons:string[]=[];
  if (annualActual < policy.annual_minimum_hours) eligibilityReasons.push(`Billable utilization is below the ${policy.minimum_percent}% level minimum`);
  const minimumOverallScore=Number(input.eligibilityRules?.minimumOverallScore??80);
  const maximumEscalations=Number(input.eligibilityRules?.maximumEscalations??2);
  if (overallScore < minimumOverallScore) eligibilityReasons.push(`Overall performance score is below ${minimumOverallScore}%`);
  if (escalationCount > maximumEscalations) eligibilityReasons.push(`${countLabel(maximumEscalations + 1)} or more qualifying client escalations occurred`);
  const criticalFlags:string[]=[];
  if (escalationCount >= 5) criticalFlags.push("Termination Criteria Met — 5 or more qualifying client escalations");
  if (refundCount >= 3) criticalFlags.push("Termination Criteria Met — 3 or more qualifying client refunds");
  return { policy, monthly, quarterly, annualExpected:policy.annual_expected_hours, annualActual, utilizationPercent, boosterScore, penaltyScore, overallScore, category:performanceCategory(overallScore,input.performanceCategories), eligibility:eligibilityReasons.length ? "not_eligible" : input.reviewFinalized ? "eligible" : "pending_review", eligibilityReasons, criticalFlags, scoredEvents };
}

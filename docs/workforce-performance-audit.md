# Workforce loading and query audit

## Before this change

Opening `/team` (Workforce) always selected Overview in local React state and
executed the following requests. The approximate sizes describe cardinality,
not production row counts.

| Request | Source | Tables | Purpose | Approximate result | Notes |
| --- | --- | --- | --- | --- | --- |
| `auth.getUser()` | `app/(app)/team/page.tsx` | Supabase Auth | Validate session | 1 user | Required shell request. |
| `profiles(role,employee_id)` | `app/(app)/team/page.tsx` | `profiles` | Permission and employee scope | 1 row | Required shell request; `user_id` is unique/indexed. |
| `get_reporting_manager_options()` | `app/(app)/team/page.tsx` | profiles/employees inside RPC | New-member form options | Organization manager list | Previously ran for every admin opening Overview although the form was closed. |
| `get_team_metric_employees()` or direct employee select | `lib/metrics/team-metrics.ts` | `employees` | Visible workforce | Own row, direct reports, or organization | Retrieved HR fields not used by Overview. |
| reporting manager select | `lib/metrics/team-metrics.ts` | `employees` | Resolve manager names | One row per distinct manager | A second employee query; not row-by-row N+1, but avoidable. |
| active timer select | `lib/metrics/team-metrics.ts` | `active_timers`, `projects`, `clients` | Live status panel | At most one active timer per visible employee | Required by Overview. |
| paged raw time-entry select | `lib/metrics/team-metrics.ts` | `time_entries`, `projects`, `clients` | Hours, utilization, session and distinct counts | Every matching entry, 1,000 rows per request until exhausted | Principal timeout/payload risk. It joined related rows, sorted, transferred all entries, and aggregated in JavaScript. No useful employee/date index existed in the baseline. |
| holiday select | `lib/metrics/team-metrics.ts` | `holidays` | Expected capacity | Holidays in selected period | Required and date bounded. |
| leave-day select | `lib/metrics/team-metrics.ts` | `leave_request_days` | Expected capacity | Approved working leave slots for visible employees and period | Required and bounded, but lacked an employee/date partial index for this access pattern. |

Inactive tab components were conditionally rendered, so their effects did not
run on the first Overview render. They were nevertheless statically imported
into the Workforce client bundle. Organization Chart also depended on the
Overview employee result, which prevented independent loading. The local-only
tab state made every direct visit start at Overview, so Reviews could not be
deep-linked without first paying the Overview query cost.

Reviews had a separate high-volume path: when opened it paged every billable
`time_entries` row for the authorized employees and selected year, then grouped
the rows into months in Node.js.

## After this change

The Workforce shell always loads only the session and the caller's two-column
profile. The active tab comes from `?tab=` and inactive tab modules are dynamic
imports.

Overview then loads:

1. `get_workforce_overview_employees()` — one role-scoped, narrow employee and
   manager query.
2. `get_workforce_overview_time_summary(start,end)` — one date-bounded SQL
   aggregate returning one row per visible employee instead of raw entries.
3. Active timers, period holidays, and period leave slots in parallel.

`get_reporting_manager_options()` now runs only after an authorized admin opens
the New Workforce Member form. Organization Chart independently calls the
narrow workforce directory RPC only when its tab mounts. Reviews independently
calls its API only when its dynamically imported tab mounts; annual billable
hours are returned as at most 12 aggregate rows per employee.

Profile Approvals is permission gated, dynamically mounted, and server-paged at
25 rows (maximum accepted page size 50). Assets and Exit Process are currently
placeholder modules and issue no database requests. Policies is static content
and its bundle is deferred until selected.

## Index decisions

- `time_entries(employee_id, entry_date) INCLUDE (project_id, hours)` matches
  both Overview period aggregation and Reviews annual/month aggregation.
- `employees(reporting_manager_id, status, id)` supports direct-report scope.
- A partial `leave_request_days(employee_id, leave_date)` index supports only
  the approved/cancellation-requested working slots used for capacity.

No timeout setting, RLS policy, permission rule, utilization formula, or
performance scoring rule was changed.

## Remaining risks

Performance event and comment histories are year- and authorization-scoped but
are still returned together because every event is required for the transparent
score calculation. If those year-level sets become large, the next safe step is
a database calculation snapshot plus a separately paginated event-history API;
limiting the current rows would change scores and is therefore intentionally not
part of this optimization.

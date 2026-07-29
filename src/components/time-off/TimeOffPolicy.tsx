import type { ReactNode } from "react";
import TimeOffIcon, { type TimeOffIconName } from "./TimeOffIcon";
import KairoCard from "./TimeOffPremiumCard";

const effectiveDate = "01 January 2026";

function PolicySection({
  title,
  summary,
  icon,
  tone,
  children,
  open = false,
}: {
  title: string;
  summary: string;
  icon: TimeOffIconName;
  tone: string;
  children: ReactNode;
  open?: boolean;
}) {
  return (
    <details open={open} className="group overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition hover:border-blue-200 hover:shadow-md">
      <summary className="flex cursor-pointer list-none items-center gap-4 px-5 py-5 marker:content-none sm:px-6">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${tone}`}>
          <TimeOffIcon name={icon} className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold text-slate-950">{title}</span>
          <span className="mt-1 block text-sm leading-5 text-slate-500">{summary}</span>
        </span>
        <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-xl text-slate-500 transition group-open:rotate-45 group-open:bg-blue-50 group-open:text-[#153E90]">+</span>
      </summary>
      <div className="border-t border-slate-100 bg-gradient-to-br from-white to-slate-50/70 px-5 py-5 text-sm leading-6 text-slate-600 sm:px-6">
        {children}
      </div>
    </details>
  );
}

function PolicyList({ children }: { children: ReactNode }) {
  return <ul className="space-y-3 [&>li]:relative [&>li]:pl-5 [&>li]:before:absolute [&>li]:before:left-0 [&>li]:before:top-[.65rem] [&>li]:before:h-1.5 [&>li]:before:w-1.5 [&>li]:before:rounded-full [&>li]:before:bg-blue-500">{children}</ul>;
}

export default function TimeOffPolicy() {
  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#081226] via-[#153E90] to-cyan-700 px-6 py-8 text-white shadow-[0_28px_70px_-38px_rgba(15,23,42,.9)] sm:px-9 sm:py-10">
        <span className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-cyan-300/20 blur-3xl" />
        <span className="pointer-events-none absolute -bottom-28 left-1/3 h-56 w-56 rounded-full bg-violet-400/20 blur-3xl" />
        <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-cyan-100 backdrop-blur">
                <TimeOffIcon name="shield" className="h-6 w-6" />
              </span>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-200">Despacho Inc.</p>
            </div>
            <h2 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">Leave &amp; Time Off Policy</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100 sm:text-base">A clear guide to eligibility, leave balances, payroll impact, approvals, holidays, and year-end processing in Kairo.</p>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur"><dt className="text-[10px] font-bold uppercase tracking-wider text-blue-200">Effective</dt><dd className="mt-1 font-bold">{effectiveDate}</dd></div>
            <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur"><dt className="text-[10px] font-bold uppercase tracking-wider text-blue-200">Policy version</dt><dd className="mt-1 font-bold">1.0</dd></div>
          </dl>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["12 Days", "Annual paid entitlement after one year", "text-blue-800", "from-blue-50 to-cyan-50"],
          ["2 Days", "Combined PL and UL monthly limit", "text-emerald-800", "from-emerald-50 to-teal-50"],
          ["6 Days", "Annual Unplanned Leave limit", "text-amber-800", "from-amber-50 to-orange-50"],
          ["No Carry-forward", "Unused balance enters year-end review", "text-violet-800", "from-violet-50 to-fuchsia-50"],
        ].map(([value, label, valueTone, background]) => (
          <KairoCard key={value} className={`overflow-hidden bg-gradient-to-br ${background} p-5`}>
            <p className={`text-xl font-bold tracking-tight ${valueTone}`}>{value}</p>
            <p className="mt-2 text-sm leading-5 text-slate-600">{label}</p>
          </KairoCard>
        ))}
      </section>

      <KairoCard className="overflow-hidden p-0">
        <div className="border-b border-blue-100 bg-gradient-to-r from-blue-50 via-white to-cyan-50 px-6 py-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#153E90]">Published policy</p>
          <h3 className="mt-2 text-2xl font-bold text-slate-950">How leave works at Despacho</h3>
          <p className="mt-2 text-sm text-slate-500">Select a section to read the policy. Kairo applies these rules automatically when a request is evaluated.</p>
        </div>
        <div className="grid gap-4 p-5 sm:p-6 lg:grid-cols-2">
          <PolicySection title="Eligibility and annual entitlement" summary="Service-based rules for employees and contractors." icon="people" tone="bg-blue-100 text-blue-700" open>
            <PolicyList>
              <li><strong className="text-slate-900">Employees in their first year:</strong> paid leave accrues at one day for each completed service month. Up to one combined Planned or Unplanned Leave application may be submitted per month.</li>
              <li><strong className="text-slate-900">After one completed year:</strong> the annual paid entitlement is 12 days. Up to two combined Planned or Unplanned Leave applications may be submitted per month.</li>
              <li>The normal combined Planned and Unplanned Leave allowance is two working days per month, subject to the available balance.</li>
              <li>Pending requests reserve leave until they are approved, rejected, or cancelled.</li>
            </PolicyList>
          </PolicySection>

          <PolicySection title="Contractor policy" summary="Three service stages with different paid-leave and LOP rules." icon="clock" tone="bg-cyan-100 text-cyan-700">
            <PolicyList>
              <li><strong className="text-slate-900">Under six completed months:</strong> Planned and Unplanned Leave are unavailable. LOP is unlimited and each LOP day deducts one salary day.</li>
              <li><strong className="text-slate-900">Six to eleven completed months:</strong> one paid day accrues monthly and the normal first-year application rules apply. The annual LOP reference becomes three days and each LOP day deducts 1.5 salary days.</li>
              <li><strong className="text-slate-900">After one completed year:</strong> the standard employee entitlement and LOP rules apply.</li>
            </PolicyList>
          </PolicySection>

          <PolicySection title="Planned and Unplanned Leave" summary="Normal monthly limits and the annual extended exception." icon="calendar" tone="bg-emerald-100 text-emerald-700">
            <PolicyList>
              <li><strong className="text-slate-900">Planned Leave (PL):</strong> intended for planned time away. A normal request follows the monthly paid-leave limit.</li>
              <li><strong className="text-slate-900">Unplanned Leave (UL):</strong> intended for unexpected absence, limited to two working days per request and six days per calendar year.</li>
              <li>After one completed year, one extended Planned Leave exception may be used each calendar year for up to five working days within a maximum nine-day calendar span, in a single month.</li>
              <li>The extended exception is unavailable once used or when qualifying excess leave has already been recorded as LOP.</li>
            </PolicyList>
          </PolicySection>

          <PolicySection title="Loss of Pay" summary="Payroll deductions, annual reference, and administrative override." icon="wallet" tone="bg-rose-100 text-rose-700">
            <PolicyList>
              <li>LOP is unpaid leave. Under the standard rule, one LOP day produces a payroll deduction equivalent to 1.5 salary days.</li>
              <li>The standard per-request maximum is two working days.</li>
              <li>Three LOP days is the annual reference. A request exceeding that reference requires an authorised administrative override and a recorded reason.</li>
              <li>The contractor waiting-period exception—unlimited LOP at a one-day salary deduction per LOP day—applies only before six completed service months.</li>
            </PolicyList>
          </PolicySection>

          <PolicySection title="Maternity and Paternity Leave" summary="Gender and service eligibility enforced automatically." icon="shield" tone="bg-fuchsia-100 text-fuchsia-700">
            <PolicyList>
              <li><strong className="text-slate-900">Maternity Leave:</strong> available to female employees after 24 completed service months, for up to six calendar months.</li>
              <li><strong className="text-slate-900">Paternity Leave:</strong> available to male employees after 24 completed service months, for up to five working days.</li>
              <li>Female employees are not assigned Paternity Leave balances, and male employees are not assigned Maternity Leave balances.</li>
              <li>Kairo hides ineligible parental leave types and blocks an ineligible request at the policy boundary.</li>
            </PolicyList>
          </PolicySection>

          <PolicySection title="How leave days are counted" summary="Working days, holidays, weekends, half days, and overlaps." icon="chart" tone="bg-indigo-100 text-indigo-700">
            <PolicyList>
              <li>Planned Leave, Unplanned Leave, LOP, and Paternity Leave are calculated using chargeable working days; configured holidays and weekly offs are excluded.</li>
              <li>Maternity Leave is measured as calendar time.</li>
              <li>Full-day, first-half, and second-half requests are supported where the leave type allows them.</li>
              <li>Overlapping active leave requests are blocked. An approved full-day leave also prevents a work timer from running for that day.</li>
            </PolicyList>
          </PolicySection>

          <PolicySection title="Request, approval, and cancellation" summary="What happens from submission through the final decision." icon="check" tone="bg-amber-100 text-amber-700">
            <PolicyList>
              <li>Kairo validates eligibility, available balance, monthly and annual limits, holidays, weekly offs, overlaps, and payroll impact before submission.</li>
              <li>Requests are routed to the employee&apos;s reporting manager. Authorised administrators handle policy overrides where required.</li>
              <li>A pending request may be cancelled directly by the employee.</li>
              <li>Cancellation of an approved request returns to the approval queue. The approved leave remains effective until the cancellation is approved.</li>
              <li>Every submission, decision, cancellation, override, and balance adjustment is retained in the audit history.</li>
            </PolicyList>
          </PolicySection>

          <PolicySection title="Holidays, balances, and year-end" summary="Calendar treatment, carry-forward, and encashment review." icon="document" tone="bg-violet-100 text-violet-700">
            <PolicyList>
              <li>The company holiday calendar is published in Kairo and is used automatically when chargeable leave is calculated.</li>
              <li>Past and current holidays are protected from deletion so historical calculations remain reliable.</li>
              <li>Unused leave does not carry forward automatically to the next year.</li>
              <li>At year-end, the encashable estimate is the remaining paid leave after deducting actual LOP days, with a minimum of zero. Final processing is completed by authorised administrators.</li>
            </PolicyList>
          </PolicySection>
        </div>
      </KairoCard>

      <div className="rounded-2xl border border-blue-100 bg-blue-50/70 px-5 py-4 text-sm leading-6 text-blue-900">
        <strong>Need clarification?</strong> Speak with your reporting manager or HR before submitting a request. The live calculation shown in the Request Leave form is the applicable system evaluation for the selected dates.
      </div>
    </div>
  );
}

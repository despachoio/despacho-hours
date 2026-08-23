"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type {
  WorkforceActivityPayload,
  WorkforceEvent,
  WorkforceEventType,
} from "@/lib/dashboard/workforce-activity";
import { DashboardPanelHeader } from "@/components/dashboard/DashboardPanelHeader";

const tones: Record<WorkforceEventType, { accent: string; surface: string; icon: string }> = {
  birthday: { accent: "text-violet-700", surface: "bg-violet-50 border-violet-100", icon: "✦" },
  anniversary: { accent: "text-amber-700", surface: "bg-amber-50 border-amber-100", icon: "◆" },
  new_joiner: { accent: "text-cyan-700", surface: "bg-cyan-50 border-cyan-100", icon: "+" },
  leave: { accent: "text-emerald-700", surface: "bg-emerald-50 border-emerald-100", icon: "✓" },
  last_working_day: { accent: "text-rose-700", surface: "bg-rose-50 border-rose-100", icon: "↗" },
};

function displayDate(value: string, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    ...options,
  }).format(new Date(`${value}T00:00:00Z`));
}

function calendarDateParts(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return {
    weekday: new Intl.DateTimeFormat("en-IN", {
      timeZone: "UTC",
      weekday: "long",
    }).format(date),
    day: new Intl.DateTimeFormat("en-IN", {
      timeZone: "UTC",
      day: "2-digit",
    }).format(date),
    monthYear: new Intl.DateTimeFormat("en-IN", {
      timeZone: "UTC",
      month: "short",
      year: "numeric",
    }).format(date),
  };
}

function CalendarDateTile({
  value,
  through = false,
}: {
  value: string;
  through?: boolean;
}) {
  const date = calendarDateParts(value);
  const accessibleDate = displayDate(value, {
    weekday: "long",
    year: "numeric",
  });

  return (
    <div
      aria-label={through ? `Through ${accessibleDate}` : accessibleDate}
      className="min-w-[9.25rem] overflow-hidden rounded-xl border border-blue-100 bg-white shadow-sm"
    >
      <div className="bg-[#153E90] px-3 py-1.5 text-center text-[9px] font-black uppercase tracking-[0.2em] text-white">
        {through ? "Through" : date.weekday}
      </div>

      <div className="flex items-center justify-center gap-1.5 px-3 py-2">
        <span className="text-[11px] font-extrabold uppercase tracking-wide tabular-nums text-[#153E90]">
          {date.day}
        </span>

        <span className="text-[11px] font-extrabold uppercase tracking-wide text-slate-700">
          {date.monthYear}
        </span>
      </div>
    </div>
  );
}

function eventDate(event: WorkforceEvent) {
  if (event.endDate && event.endDate !== event.date) {
    return `${displayDate(event.date)} – ${displayDate(event.endDate)}`;
  }
  return displayDate(event.date, { weekday: "short" });
}

export function WorkforceActivity() {
  const [data, setData] = useState<WorkforceActivityPayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Your session has expired");
      const response = await fetch("/api/dashboard/workforce-activity", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to load activity");
      setData(payload as WorkforceActivityPayload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load activity");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  if (loading) return <WorkforceActivitySkeleton />;
  if (error) {
    return (
      <section className="mt-9 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="font-bold text-slate-900">Today at Despacho</p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 p-4">
          <p className="text-sm text-slate-500">Workforce activity is temporarily unavailable. The rest of your dashboard is unaffected.</p>
          <button onClick={() => void load()} className="rounded-full bg-[#153E90] px-4 py-2 text-sm font-bold text-white">Retry</button>
        </div>
      </section>
    );
  }
  if (!data) return null;

  return (
    <section className="mt-9 grid items-start gap-6 xl:grid-cols-2">
      <article className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-lg shadow-slate-200/40">
        <DashboardPanelHeader
          eyebrow="People moments"
          title="Today at Despacho"
          description="Today’s celebrations, leave and milestones."
          trailing={<CalendarDateTile value={data.businessDate} />}
        />
        <div className="p-5 sm:p-7">
          {data.today.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {data.today.map((event) => <ActivityCard key={event.id} event={event} />)}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-5 py-7 text-center">
              <p className="font-bold text-slate-800">A clear day ahead</p>
              <p className="mt-1 text-sm text-slate-500">No workforce events are scheduled for today.</p>
            </div>
          )}
        </div>
      </article>

      <article className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-lg shadow-slate-200/40">
        <DashboardPanelHeader
          eyebrow="Next seven days"
          title="Coming Up"
          description="Plan ahead for upcoming team moments."
          trailing={<CalendarDateTile value={data.upcomingThrough} through />}
        />
        <div className="p-5 sm:p-7">
          {data.upcoming.length ? (
            <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200">
              {data.upcoming.map((event) => <TimelineRow key={event.id} event={event} />)}
            </div>
          ) : (
            <p className="rounded-2xl bg-slate-50 px-5 py-7 text-center text-sm font-semibold text-slate-500">Nothing scheduled in the next seven days.</p>
          )}
        </div>
      </article>
    </section>
  );
}

function ActivityCard({ event }: { event: WorkforceEvent }) {
  const tone = tones[event.type];
  const content = (
    <div className={`h-full rounded-2xl border p-4 ${tone.surface}`}>
      <div className="flex items-start gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-lg font-black shadow-sm ${tone.accent}`}>{tone.icon}</span>
        <div className="min-w-0">
          <p className="font-bold text-slate-950">{event.title}</p>
          <p className={`mt-1 text-xs font-bold ${tone.accent}`}>{event.detail}</p>
          <p className="mt-2 text-xs font-semibold text-slate-500">{eventDate(event)}</p>
        </div>
      </div>
    </div>
  );
  return event.targetRoute ? <Link href={event.targetRoute}>{content}</Link> : content;
}

function TimelineRow({ event }: { event: WorkforceEvent }) {
  const tone = tones[event.type];
  const row = (
    <div className="grid gap-3 px-4 py-4 transition hover:bg-slate-50 sm:grid-cols-[120px_44px_1fr_auto] sm:items-center">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{eventDate(event)}</p>
      <span className={`flex h-9 w-9 items-center justify-center rounded-xl border text-base font-black ${tone.surface} ${tone.accent}`}>{tone.icon}</span>
      <div>
        <p className="font-bold text-slate-900">{event.title}</p>
        <p className="mt-0.5 text-xs font-semibold text-slate-500">{event.detail}</p>
      </div>
      {event.targetRoute ? <span className="hidden text-sm font-bold text-[#153E90] sm:block">View →</span> : null}
    </div>
  );
  return event.targetRoute ? <Link href={event.targetRoute}>{row}</Link> : row;
}

function WorkforceActivitySkeleton() {
  return (
    <section aria-label="Loading workforce activity" className="mt-9 grid animate-pulse gap-6 xl:grid-cols-2">
      {[0, 1].map((panel) => (
        <div key={panel} className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-sm">
          <div className="h-3 w-28 rounded bg-slate-200" />
          <div className="mt-3 h-7 w-56 rounded bg-slate-200" />
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {[0, 1].map((item) => <div key={item} className="h-28 rounded-2xl bg-slate-100" />)}
          </div>
        </div>
      ))}
    </section>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Tab = "upcoming" | "active" | "paused";
type Schedule = {
  id: string;
  client_id: string;
  name: string;
  status: string;
  frequency: string;
  interval_count: number;
  currency: string;
  auto_send: boolean;
  autopay_enabled: boolean;
  next_generation_date: string;
  email_to: string | null;
  clients: { name: string } | null;
  recurring_invoice_items: {
    amount: number;
  }[];
};
type Occurrence = {
  id: string;
  scheduled_date: string;
  status: string;
  email_to: string | null;
  skip_reason: string | null;
  generated_invoice_id: string | null;
  recurring_invoice_schedules: Schedule | null;
  invoices: {
    invoice_number: number;
    status: string;
    total_amount: number;
    generated_from_recurring: boolean;
  } | null;
};
type Client = { id: string; name: string };

const tabs: { id: Tab; label: string }[] = [
  { id: "upcoming", label: "Upcoming" },
  { id: "active", label: "Active Schedules" },
  { id: "paused", label: "Paused" },
];
const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
const money = (currency: string, amount: number) =>
  `${currency} ${Number(amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function RecurringInvoicesWorkspace({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("upcoming");
  const [clients, setClients] = useState<Client[]>([]);
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientId, setClientId] = useState("");
  const [frequency, setFrequency] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [count, setCount] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [skipTarget, setSkipTarget] = useState<Occurrence | null>(null);
  const [skipReason, setSkipReason] = useState("");
  const [resumeTarget, setResumeTarget] = useState<Schedule | null>(null);
  const [resumeDate, setResumeDate] = useState("");
  const [cancelTarget, setCancelTarget] = useState<Schedule | null>(null);
  const [cancellationReason, setCancellationReason] = useState("");
  const pageSize = 20;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    if (tab === "upcoming") {
      let query = supabase
        .from("recurring_invoice_schedules")
        .select(
          `id,client_id,name,status,frequency,interval_count,currency,auto_send,autopay_enabled,next_generation_date,email_to,clients(name),recurring_invoice_items(amount),recurring_invoice_occurrences!inner(id,scheduled_date,status,email_to,skip_reason,generated_invoice_id,invoices!recurring_invoice_occurrences_generated_invoice_id_fkey(invoice_number,status,total_amount,generated_from_recurring))`,
          { count: "exact" },
        )
        .eq("status", "active")
        .eq("recurring_invoice_occurrences.status", "pending")
        .gte(
          "recurring_invoice_occurrences.scheduled_date",
          new Date().toISOString().slice(0, 10),
        );
      if (clientId) query = query.eq("client_id", clientId);
      if (frequency) query = query.eq("frequency", frequency);
      if (from)
        query = query.gte("recurring_invoice_occurrences.scheduled_date", from);
      if (to)
        query = query.lte("recurring_invoice_occurrences.scheduled_date", to);
      const result = await query
        .order("next_generation_date")
        .order("scheduled_date", {
          ascending: true,
          referencedTable: "recurring_invoice_occurrences",
        })
        .range(page * pageSize, page * pageSize + pageSize - 1);
      if (result.error) setError(result.error.message);
      const scheduleRows = (result.data || []) as unknown as (Schedule & {
        recurring_invoice_occurrences: Omit<
          Occurrence,
          "recurring_invoice_schedules"
        >[];
      })[];
      setOccurrences(
        scheduleRows.flatMap((schedule) => {
          const nextOccurrence = schedule.recurring_invoice_occurrences[0];
          return nextOccurrence
            ? [{ ...nextOccurrence, recurring_invoice_schedules: schedule }]
            : [];
        }),
      );
      setSchedules([]);
      setCount(result.count || 0);
    } else {
      let query = supabase
        .from("recurring_invoice_schedules")
        .select(
          "id,client_id,name,status,frequency,interval_count,currency,auto_send,autopay_enabled,next_generation_date,email_to,clients(name),recurring_invoice_items(amount)",
          { count: "exact" },
        )
        .eq("status", tab);
      if (clientId) query = query.eq("client_id", clientId);
      if (frequency) query = query.eq("frequency", frequency);
      const result = await query
        .order("next_generation_date")
        .range(page * pageSize, page * pageSize + pageSize - 1);
      if (result.error) setError(result.error.message);
      setSchedules((result.data || []) as unknown as Schedule[]);
      setOccurrences([]);
      setCount(result.count || 0);
    }
    setLoading(false);
  }, [clientId, frequency, from, page, status, tab, to]);

  useEffect(() => {
    void supabase
      .from("clients")
      .select("id,name")
      .order("name")
      .then(({ data }) => setClients((data || []) as Client[]));
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    setPage(0);
  }, [tab, clientId, frequency, status, from, to]);

  const visibleOccurrences = useMemo(
    () =>
      occurrences.filter(
        (row) =>
          !search ||
          `${row.recurring_invoice_schedules?.name} ${row.recurring_invoice_schedules?.clients?.name}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [occurrences, search],
  );
  const visibleSchedules = useMemo(
    () =>
      schedules.filter(
        (row) =>
          !search ||
          `${row.name} ${row.clients?.name}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [schedules, search],
  );
  async function api(path: string, body?: object) {
    const { data } = await supabase.auth.getSession();
    const response = await fetch(path, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${data.session?.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body || {}),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new Error(result?.error || "Action failed");
    return result;
  }
  async function updateStatus(
    schedule: Schedule,
    nextStatus: string,
    confirmedNextDate?: string,
    reason?: string,
  ) {
    setBusy(schedule.id);
    try {
      await api(`/api/recurring-invoices/${schedule.id}/status`, {
        status: nextStatus,
        ...(nextStatus === "active"
          ? {
              nextGenerationDate:
                confirmedNextDate || schedule.next_generation_date,
            }
          : {}),
        ...(nextStatus === "cancelled"
          ? { cancellationReason: reason || "" }
          : {}),
      });
      setResumeTarget(null);
      setCancelTarget(null);
      setCancellationReason("");
      await load();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Unable to update schedule",
      );
    } finally {
      setBusy("");
    }
  }
  async function skip() {
    if (!skipTarget?.recurring_invoice_schedules || !skipReason.trim()) return;
    setBusy(skipTarget.id);
    try {
      await api(
        `/api/recurring-invoices/${skipTarget.recurring_invoice_schedules.id}/occurrences/${skipTarget.scheduled_date}/skip`,
        { reason: skipReason },
      );
      setSkipTarget(null);
      setSkipReason("");
      await load();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Unable to skip occurrence",
      );
    } finally {
      setBusy("");
    }
  }

  return (
    <div
      className={embedded ? "" : "min-h-screen bg-[#f8fafc] px-5 py-7 sm:px-8"}
    >
      <div className="mx-auto max-w-7xl">
        {!embedded ? (
          <div className="flex flex-col gap-5 rounded-[2rem] bg-gradient-to-br from-[#0F172A] to-[#153E90] px-7 py-8 text-white shadow-xl shadow-blue-950/10 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.22em] text-blue-200">
                Invoice Automation
              </p>
              <h1 className="mt-2 text-4xl font-bold">Recurring Invoices</h1>
              <p className="mt-2 text-sm text-blue-100">
                Plan, review, and generate editable invoice Drafts.
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push("/invoices/recurring/new")}
              className="rounded-2xl bg-white px-5 py-3 text-sm font-bold text-[#153E90] shadow-lg"
            >
              + New Schedule
            </button>
          </div>
        ) : null}
        <div className="mt-7 flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold ${tab === item.id ? "bg-[#0F172A] text-white" : "text-slate-500 hover:bg-slate-50"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="mt-5 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-3 xl:grid-cols-6">
          <select
            value={clientId}
            onChange={(event) => setClientId(event.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
          >
            <option value="">All clients</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
          <select
            value={frequency}
            onChange={(event) => setFrequency(event.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
          >
            <option value="">All frequencies</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="yearly">Yearly</option>
            <option value="custom">Custom</option>
          </select>
          <input
            type="date"
            aria-label="From date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
          />
          <input
            type="date"
            aria-label="To date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
          />
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="generated">Generated</option>
            <option value="skipped">Skipped</option>
          </select>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search schedule or client"
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
          />
        </div>
        {error ? (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : null}
        <div className="mt-5 space-y-4">
          {loading ? (
            <div className="rounded-3xl bg-white py-20 text-center text-slate-500 ring-1 ring-slate-200">
              Loading recurring invoices…
            </div>
          ) : null}
          {!loading && tab === "upcoming"
            ? visibleOccurrences.map((row) => {
                const schedule = row.recurring_invoice_schedules;
                if (!schedule) return null;
                const items = schedule.recurring_invoice_items || [];
                const amount = items.reduce(
                  (sum, item) => sum + Number(item.amount || 0),
                  0,
                );
                return (
                  <article
                    key={row.id}
                    className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div className="grid items-center gap-5 xl:grid-cols-[180px_1.3fr_180px_minmax(360px,auto)]">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          Next scheduled date
                        </p>
                        <p className="mt-2 font-bold">
                          {formatDate(row.scheduled_date)}
                        </p>
                      </div>
                      <div>
                        <p className="text-lg font-bold">
                          {schedule.clients?.name}
                        </p>
                        <p className="mt-1 text-xs font-semibold capitalize text-slate-400">
                          Every{" "}
                          {schedule.interval_count > 1
                            ? `${schedule.interval_count} `
                            : ""}
                          {schedule.frequency}
                        </p>
                      </div>
                      <div>
                        <p className="mt-2 font-bold text-[#153E90]">
                          {money(
                            schedule.currency,
                            row.invoices?.total_amount ?? amount,
                          )}
                        </p>
                        <span className="mt-2 inline-flex rounded-full bg-violet-50 px-2 py-1 text-[10px] font-bold text-violet-700">
                          {schedule.autopay_enabled
                            ? "AUTOPAY ON"
                            : "AUTOPAY OFF"}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-start justify-end gap-2">
                        {row.status === "pending" ? (
                          <>
                            <button
                              onClick={() =>
                                router.push(
                                  `/invoices/recurring/${schedule.id}/occurrences/${row.scheduled_date}/edit`,
                                )
                              }
                              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold"
                            >
                              Preview / Edit
                            </button>
                            <button
                              onClick={() => {
                                setSkipTarget(row);
                                setSkipReason("");
                              }}
                              className="rounded-xl border border-amber-200 px-3 py-2 text-xs font-bold text-amber-700"
                            >
                              Skip
                            </button>
                            <button
                              onClick={() =>
                                router.push(
                                  `/invoices/recurring/${schedule.id}/edit`,
                                )
                              }
                              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold"
                            >
                              Edit Schedule
                            </button>
                            <button
                              onClick={() =>
                                void updateStatus(schedule, "paused")
                              }
                              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold"
                            >
                              Pause
                            </button>
                          </>
                        ) : row.generated_invoice_id ? (
                          <button
                            onClick={() =>
                              router.push(
                                `/invoices/${row.generated_invoice_id}`,
                              )
                            }
                            className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-bold text-white"
                          >
                            Invoice #{row.invoices?.invoice_number}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-500">
                            {row.skip_reason}
                          </span>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })
            : null}
          {!loading && ["active", "paused"].includes(tab)
            ? visibleSchedules.map((schedule) => (
                <article
                  key={schedule.id}
                  className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          router.push(
                            `/invoices/recurring/${schedule.id}`,
                          )
                        }
                        className="text-left text-lg font-bold hover:text-[#153E90]"
                      >
                        {schedule.name}
                      </button>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase">
                        {schedule.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {schedule.clients?.name} · {schedule.frequency} · Next{" "}
                      {formatDate(schedule.next_generation_date)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        router.push(
                          `/invoices/recurring/${schedule.id}/edit`,
                        )
                      }
                      className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold"
                    >
                      Edit Schedule
                    </button>
                    <button
                      onClick={() => {
                        if (schedule.status === "active")
                          void updateStatus(schedule, "paused");
                        else {
                          setResumeTarget(schedule);
                          setResumeDate(schedule.next_generation_date);
                        }
                      }}
                      disabled={busy === schedule.id}
                      className="rounded-xl bg-[#153E90] px-4 py-2 text-sm font-bold text-white"
                    >
                      {schedule.status === "active" ? "Pause" : "Resume"}
                    </button>
                    <button
                      onClick={() => {
                        setCancelTarget(schedule);
                        setCancellationReason("");
                      }}
                      className="rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-red-600"
                    >
                      Cancel Schedule
                    </button>
                  </div>
                </article>
              ))
            : null}
          {!loading &&
          !visibleOccurrences.length &&
          !visibleSchedules.length ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white py-20 text-center">
              <h2 className="font-bold">
                No recurring invoices match these filters.
              </h2>
              <button
                onClick={() => {
                  setClientId("");
                  setFrequency("");
                  setStatus("");
                  setFrom("");
                  setTo("");
                  setSearch("");
                }}
                className="mt-3 text-sm font-bold text-[#153E90]"
              >
                Clear filters
              </button>
            </div>
          ) : null}
        </div>
        {count > pageSize ? (
          <div className="mt-6 flex items-center justify-between text-sm text-slate-500">
            <span>
              Showing {page * pageSize + 1}–
              {Math.min((page + 1) * pageSize, count)} of {count}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page === 0}
                onClick={() => setPage((value) => value - 1)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 font-bold disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={(page + 1) * pageSize >= count}
                onClick={() => setPage((value) => value + 1)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 font-bold disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>
      {skipTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-bold">Skip this occurrence?</h2>
            <p className="mt-2 text-sm text-slate-500">
              The schedule will remain active and later occurrences will not
              change.
            </p>
            <textarea
              value={skipReason}
              onChange={(event) => setSkipReason(event.target.value)}
              placeholder="Reason for skipping"
              rows={4}
              className="mt-5 w-full rounded-2xl border border-slate-200 p-3"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setSkipTarget(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 font-bold"
              >
                Cancel
              </button>
              <button
                disabled={!skipReason.trim()}
                onClick={() => void skip()}
                className="rounded-xl bg-amber-600 px-4 py-2 font-bold text-white disabled:opacity-50"
              >
                Skip Occurrence
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {resumeTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-bold">Resume schedule</h2>
            <p className="mt-2 text-sm text-slate-500">
              Confirm the next generation date. Missed occurrences will not be
              generated automatically.
            </p>
            <input
              type="date"
              value={resumeDate}
              onChange={(event) => setResumeDate(event.target.value)}
              className="mt-5 w-full rounded-2xl border border-slate-200 p-3"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setResumeTarget(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 font-bold"
              >
                Cancel
              </button>
              <button
                disabled={!resumeDate}
                onClick={() =>
                  void updateStatus(resumeTarget, "active", resumeDate)
                }
                className="rounded-xl bg-[#153E90] px-4 py-2 font-bold text-white disabled:opacity-50"
              >
                Resume Schedule
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {cancelTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-schedule-title"
        >
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <h2 id="cancel-schedule-title" className="text-xl font-bold">
              Cancel recurring schedule?
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Future invoices will be cancelled. Existing invoices and
              project-wallet transactions will remain unchanged.
            </p>
            <label className="mt-5 block text-sm font-semibold text-slate-700">
              Cancellation Reason
              <textarea
                value={cancellationReason}
                onChange={(event) => setCancellationReason(event.target.value)}
                rows={4}
                className="mt-2 w-full rounded-2xl border border-slate-200 p-3 font-normal"
                placeholder="Explain why this subscription is being cancelled"
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 font-bold"
              >
                Keep Schedule
              </button>
              <button
                type="button"
                disabled={
                  !cancellationReason.trim() || busy === cancelTarget.id
                }
                onClick={() =>
                  void updateStatus(
                    cancelTarget,
                    "cancelled",
                    undefined,
                    cancellationReason,
                  )
                }
                className="rounded-xl bg-red-600 px-4 py-2 font-bold text-white disabled:opacity-50"
              >
                {busy === cancelTarget.id ? "Cancelling…" : "Cancel Schedule"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function RecurringInvoicesPage() {
  return <RecurringInvoicesWorkspace />;
}

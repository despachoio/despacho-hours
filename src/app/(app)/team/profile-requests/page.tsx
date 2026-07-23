"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  PROFILE_FIELD_LABELS,
  type EmployeeProfileChanges,
} from "@/lib/employee-profile";

type ProfileRequest = {
  id: string;
  employee_id: string;
  current_values: EmployeeProfileChanges;
  proposed_changes: EmployeeProfileChanges;
  status: string;
  created_at: string;
  employees:
    | { id: string; name: string; title: string | null; employee_code: string }
    | Array<{ id: string; name: string; title: string | null; employee_code: string }>
    | null;
};

async function token() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
}

export default function ProfileRequestsPage() {
  const [requests, setRequests] = useState<ProfileRequest[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadRequests() {
    setLoading(true);
    const accessToken = await token();
    if (!accessToken) {
      setError("Your session has expired.");
      setLoading(false);
      return;
    }
    const response = await fetch("/api/profile/change-requests", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const result = (await response.json()) as {
      requests?: ProfileRequest[];
      error?: string;
    };
    if (!response.ok) setError(result.error || "Unable to load requests.");
    else setRequests(result.requests || []);
    setLoading(false);
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadRequests(), 0);
    return () => window.clearTimeout(timeout);
  }, []);

  async function review(id: string, decision: "approved" | "rejected") {
    if (busyId) return;
    setBusyId(id);
    setError("");
    const accessToken = await token();
    if (!accessToken) {
      setError("Your session has expired.");
      setBusyId("");
      return;
    }
    const response = await fetch(`/api/profile/change-requests/${id}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ decision, notes: notes[id] || "" }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(result.error || "Unable to review this request.");
      setBusyId("");
      return;
    }
    setRequests((current) => current.filter((request) => request.id !== id));
    setBusyId("");
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] px-5 py-7 sm:px-8">
      <div className="mx-auto max-w-[1320px]">
        <Link
          href="/team"
          className="mb-5 inline-block text-sm font-bold text-slate-500 hover:text-[#153E90]"
        >
          ← Back to Team
        </Link>
        <header className="relative overflow-hidden rounded-[2rem] bg-[#0F172A] px-8 py-10 text-white shadow-xl shadow-slate-300/50 lg:px-11">
          <div className="absolute -right-24 -top-28 h-80 w-80 rounded-full bg-[#153E90]/70 blur-3xl" />
          <div className="relative">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-200">
              Employee records
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight lg:text-5xl">
              Profile Approvals
            </h1>
            <p className="mt-3 text-sm text-slate-300">
              Review employee-submitted corrections before they update the
              official profile.
            </p>
          </div>
        </header>

        {error ? (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="mt-6 rounded-3xl bg-white p-12 text-center text-sm font-semibold text-slate-500 shadow-sm">
            Loading profile requests...
          </div>
        ) : requests.length ? (
          <div className="mt-6 space-y-5">
            {requests.map((request) => {
              const employee = Array.isArray(request.employees)
                ? request.employees[0]
                : request.employees;
              const changedFields = (
                Object.keys(PROFILE_FIELD_LABELS) as Array<
                  keyof EmployeeProfileChanges
                >
              ).filter(
                (key) =>
                  (request.current_values[key] || "") !==
                  (request.proposed_changes[key] || ""),
              );
              return (
                <section
                  key={request.id}
                  className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#153E90]">
                        {employee?.employee_code || "Employee"}
                      </p>
                      <h2 className="mt-1 text-xl font-bold text-slate-950">
                        {employee?.title ? `${employee.title} ` : ""}
                        {employee?.name || "Employee profile"}
                      </h2>
                      <p className="mt-1 text-xs text-slate-500">
                        Submitted {new Date(request.created_at).toLocaleString("en-IN")}
                      </p>
                    </div>
                    <span className="w-fit rounded-full bg-amber-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                      Pending
                    </span>
                  </div>

                  <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
                    <div className="grid grid-cols-[1fr_1fr_1fr] bg-slate-50 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      <span>Field</span>
                      <span>Current</span>
                      <span>Requested</span>
                    </div>
                    {changedFields.map((key) => (
                      <div
                        key={key}
                        className="grid grid-cols-[1fr_1fr_1fr] gap-3 border-t border-slate-100 px-4 py-3 text-sm"
                      >
                        <span className="font-bold text-slate-700">
                          {PROFILE_FIELD_LABELS[key]}
                        </span>
                        <span className="break-words text-slate-500">
                          {request.current_values[key] || "—"}
                        </span>
                        <span className="break-words font-semibold text-[#153E90]">
                          {request.proposed_changes[key] || "—"}
                        </span>
                      </div>
                    ))}
                  </div>

                  <label className="mt-5 block text-sm font-semibold text-slate-700">
                    Review note (optional)
                    <textarea
                      value={notes[request.id] || ""}
                      onChange={(event) =>
                        setNotes((current) => ({
                          ...current,
                          [request.id]: event.target.value,
                        }))
                      }
                      rows={3}
                      className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                    />
                  </label>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      type="button"
                      disabled={Boolean(busyId)}
                      onClick={() => void review(request.id, "approved")}
                      className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
                    >
                      {busyId === request.id ? "Updating..." : "Approve Changes"}
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(busyId)}
                      onClick={() => void review(request.id, "rejected")}
                      className="rounded-xl border border-red-200 bg-red-50 px-5 py-2.5 text-sm font-bold text-red-700 disabled:opacity-60"
                    >
                      Reject
                    </button>
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-white p-14 text-center">
            <h2 className="text-xl font-bold text-slate-900">
              No pending profile requests
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Employee correction requests will appear here.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

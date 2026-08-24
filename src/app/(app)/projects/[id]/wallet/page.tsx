"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { formatDecimalHours } from "@/lib/format-hours";
import TimeOffIcon from "@/components/time-off/TimeOffIcon";
import {
  emptyWalletActivityFilters,
  walletActivityDateKey,
  type WalletActivityFilter as WalletFilter,
  type WalletActivityFilters,
  type WalletActivityTransaction as WalletTransaction,
  type WalletActivityTransactionWithBalance as TransactionWithBalance,
} from "@/lib/project-wallet-activity";

type Project = {
  id: string;
  name: string;
  project_code: string | null;
  purchased_hours: number;
  used_hours: number;
  remaining_hours: number;
  status: string;

  clients: {
    id: string;
    name: string;
  } | null;
};

type WalletSummary = {
  project_id: string;
  purchased_hours: number;
  used_hours: number;
  remaining_hours: number;
};

export default function ProjectWalletPage() {
  const params = useParams();
  const router = useRouter();

  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [wallet, setWallet] = useState<WalletSummary | null>(null);

  const [transactions, setTransactions] = useState<
    WalletTransaction[]
  >([]);

  const [activityFilters, setActivityFilters] =
    useState<WalletActivityFilters>(emptyWalletActivityFilters);
  const [appliedActivityFilters, setAppliedActivityFilters] =
    useState<WalletActivityFilters | null>(null);
  const [activityTransactions, setActivityTransactions] = useState<
    TransactionWithBalance[]
  >([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState("");
  const [exporting, setExporting] = useState(false);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [role, setRole] = useState("");
  const canAdjustWallet = [
    "Finance Admin",
    "Super Admin",
    "Admin",
  ].includes(role);

  function formatHours(value: number) {
    return formatDecimalHours(value);
  }

  function formatDateKey(date: string) {
    const [year, month, day] = date.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day))
      .toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      })
      .replace(/ /g, "-");
  }

  function formatTimestampDate(date: string) {
    return new Date(date)
      .toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      })
      .replace(/ /g, "-");
  }

  function formatTime(date: string) {
    return new Date(date).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    }).toUpperCase();
  }

  function getTransactionDescription(
    transaction: WalletTransaction
  ) {
    if (
      transaction.transaction_type === "time_debit" &&
      transaction.time_entries?.description
    ) {
      return transaction.time_entries.description;
    }

    if (transaction.notes) {
      return transaction.notes;
    }

    return transaction.transaction_type.replaceAll("_", " ");
  }

  function getTransactionBadge(transactionType: string) {
    switch (transactionType) {
      case "opening_credit":
        return {
          text: "Opening Credit",
          className: "bg-slate-100 text-slate-700",
        };

      case "invoice_credit":
        return {
          text: "Invoice Credit",
          className: "bg-blue-100 text-blue-700",
        };

      case "time_debit":
        return {
          text: "Usage",
          className: "bg-red-100 text-red-700",
        };

      case "manual_credit":
        return {
          text: "Manual Credit",
          className: "bg-emerald-100 text-emerald-700",
        };

      case "manual_debit":
        return {
          text: "Manual Debit",
          className: "bg-orange-100 text-orange-700",
        };

      case "adjustment":
        return {
          text: "Adjustment",
          className: "bg-indigo-100 text-indigo-700",
        };

      case "refund":
        return {
          text: "Refund",
          className: "bg-purple-100 text-purple-700",
        };

      default:
        return {
          text: transactionType.replaceAll("_", " "),
          className: "bg-slate-100 text-slate-700",
        };
    }
  }

  async function loadWallet() {
    setLoading(true);
    setErrorMessage("");

    const { data: userData, error: userError } =
      await supabase.auth.getUser();
    if (userError || !userData.user) {
      setErrorMessage("Your session has expired.");
      setLoading(false);
      return;
    }
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", userData.user.id)
      .single();
    const currentRole = String(profileData?.role || "");
    if (
      profileError ||
      !["Finance Admin", "Super Admin", "Admin", "Manager"].includes(
        currentRole,
      )
    ) {
      setErrorMessage(
        "You do not have permission to view this project wallet.",
      );
      setProject(null);
      setWallet(null);
      setLoading(false);
      return;
    }
    setRole(currentRole);

    const { data: projectData, error: projectError } =
      await supabase
        .from("projects")
        .select(`
          id,
          name,
          project_code,
          purchased_hours,
          used_hours,
          remaining_hours,
          status,
          clients(
            id,
            name
          )
        `)
        .eq("id", projectId)
        .single();

    if (projectError || !projectData) {
      console.error("Project load error:", projectError);

      setErrorMessage(
        projectError?.message || "Project could not be found."
      );

      setProject(null);
      setLoading(false);
      return;
    }

    setProject(projectData as unknown as Project);

    const { data: walletData, error: walletError } =
      await supabase
        .from("project_hour_wallets")
        .select(`
          project_id,
          purchased_hours,
          used_hours,
          remaining_hours
        `)
        .eq("project_id", projectData.id)
        .maybeSingle();

    if (walletError) {
      console.error("Wallet summary error:", walletError);
    }

    setWallet({
      project_id: projectData.id,
      purchased_hours: Number(
        walletData?.purchased_hours ??
          projectData.purchased_hours ??
          0
      ),
      used_hours: Number(
        walletData?.used_hours ??
          projectData.used_hours ??
          0
      ),
      remaining_hours: Number(
        walletData?.remaining_hours ??
          projectData.remaining_hours ??
          0
      ),
    });

    const {
      data: transactionData,
      error: transactionError,
    } = await supabase
      .from("project_hour_transactions")
      .select(`
        id,
        project_id,
        invoice_id,
        invoice_item_id,
        payment_id,
        time_entry_id,
        transaction_type,
        hours_delta,
        notes,
        created_at,
        invoices(
          invoice_number
        ),
        time_entries(
          entry_date,
          started_at,
          stopped_at,
          description,
          employee_id,
          employees(
            id,
            name
          )
        )
      `)
      .eq("project_id", projectData.id)
      .order("created_at", {
        ascending: false,
      });

    if (transactionError) {
      console.error(
        "Wallet transaction error:",
        transactionError
      );

      setErrorMessage(transactionError.message);
      setTransactions([]);
    } else {
      const normalizedTransactions = (transactionData || []) as unknown as
        WalletTransaction[];

      setTransactions(
        normalizedTransactions.map((item) => ({
          ...item,
          hours_delta: Number(item.hours_delta || 0),
        }))
      );
    }

    setLoading(false);
  }

  useEffect(() => {
    if (projectId) {
      // The wallet loader owns the async loading lifecycle for this route.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadWallet();
    }
    // Reload only when the route moves to a different project wallet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const percentageRemaining = useMemo(() => {
    const purchased = Number(wallet?.purchased_hours || 0);
    const remaining = Number(wallet?.remaining_hours || 0);

    if (purchased <= 0) return 0;

    return Math.max(
      0,
      Math.min(100, (remaining / purchased) * 100)
    );
  }, [wallet]);

  const averageDailyUsage = useMemo(() => {
    const today = new Date();

    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const usageInLastThirtyDays = transactions
      .filter((transaction) => {
        return (
          transaction.transaction_type === "time_debit" &&
          new Date(transaction.created_at) >= thirtyDaysAgo
        );
      })
      .reduce((sum, transaction) => {
        return (
          sum + Math.abs(Number(transaction.hours_delta || 0))
        );
      }, 0);

    return usageInLastThirtyDays / 30;
  }, [transactions]);

  const estimatedDaysRemaining = useMemo(() => {
    const remaining = Number(wallet?.remaining_hours || 0);

    if (remaining <= 0) return 0;
    if (averageDailyUsage <= 0) return null;

    return Math.ceil(remaining / averageDailyUsage);
  }, [averageDailyUsage, wallet]);

  const estimatedDepletionDate = useMemo(() => {
    if (
      estimatedDaysRemaining === null ||
      estimatedDaysRemaining <= 0
    ) {
      return null;
    }

    const date = new Date();
    date.setDate(date.getDate() + estimatedDaysRemaining);

    return date;
  }, [estimatedDaysRemaining]);

  const walletHealth = useMemo(() => {
    const available = Number(wallet?.remaining_hours || 0);

    if (available <= 0) {
      return {
        label: "Depleted",
        description: "No service hours are available.",
        className: "bg-red-100 text-red-700",
      };
    }

    if (
      estimatedDaysRemaining !== null &&
      estimatedDaysRemaining <= 7
    ) {
      return {
        label: "Critical",
        description: "Recharge is recommended immediately.",
        className: "bg-red-100 text-red-700",
      };
    }

    if (
      estimatedDaysRemaining !== null &&
      estimatedDaysRemaining <= 14
    ) {
      return {
        label: "Recharge Soon",
        description: "The wallet may run low within two weeks.",
        className: "bg-yellow-100 text-yellow-700",
      };
    }

    if (percentageRemaining <= 20) {
      return {
        label: "Low Balance",
        description: "The wallet has less than 20% remaining.",
        className: "bg-orange-100 text-orange-700",
      };
    }

    return {
      label: "Healthy",
      description: "The project has a healthy hour balance.",
      className: "bg-green-100 text-green-700",
    };
  }, [
    estimatedDaysRemaining,
    percentageRemaining,
    wallet,
  ]);

  const recommendedRecharge = useMemo(() => {
    if (averageDailyUsage <= 0) {
      return 0;
    }

    return Math.ceil((averageDailyUsage * 30) / 5) * 5;
  }, [averageDailyUsage]);

  const employeeOptions = useMemo(
    () =>
      Array.from(
        new Map(
          transactions
            .map((transaction) => transaction.time_entries?.employees)
            .filter(
              (employee): employee is { id: string; name: string } =>
                Boolean(employee?.id && employee?.name),
            )
            .map((employee) => [employee.id, employee]),
        ).values(),
      ).sort((left, right) => left.name.localeCompare(right.name)),
    [transactions],
  );

  async function searchActivity() {
    setActivityLoading(true);
    setActivityError("");
    setAppliedActivityFilters({ ...activityFilters });
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Your session has expired.");
      const query = new URLSearchParams({
        type: activityFilters.type,
        employee: activityFilters.employee,
        fromDate: activityFilters.fromDate,
        toDate: activityFilters.toDate,
        search: activityFilters.search,
      });
      const response = await fetch(
        `/api/projects/${projectId}/wallet-activity?${query.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const payload = (await response.json()) as {
        rows?: TransactionWithBalance[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "Unable to search wallet activity.");
      }
      setActivityTransactions(payload.rows || []);
    } catch (cause) {
      setActivityTransactions([]);
      setActivityError(
        cause instanceof Error
          ? cause.message
          : "Unable to search wallet activity.",
      );
    } finally {
      setActivityLoading(false);
    }
  }

  async function downloadActivityExcel() {
    if (!appliedActivityFilters || !activityTransactions.length) return;

    setExporting(true);

    try {
      const XLSX = await import("xlsx");
      const rows = activityTransactions.map((transaction) => ({
        Date: formatDateKey(walletActivityDateKey(transaction)),
        "Start Time": transaction.time_entries?.started_at
          ? formatTime(transaction.time_entries.started_at)
          : "—",
        "Stop Time": transaction.time_entries?.stopped_at
          ? formatTime(transaction.time_entries.stopped_at)
          : "—",
        Type: getTransactionBadge(transaction.transaction_type).text,
        Employee:
          transaction.time_entries?.employees?.name || "—",
        Description: getTransactionDescription(transaction),
        Hours: Number(transaction.hours_delta || 0),
        "Balance After": Number(transaction.balance_after || 0),
      }));
      const worksheet = XLSX.utils.json_to_sheet(rows);
      worksheet["!cols"] = [
        { wch: 15 },
        { wch: 13 },
        { wch: 13 },
        { wch: 18 },
        { wch: 24 },
        { wch: 44 },
        { wch: 12 },
        { wch: 16 },
      ];
      const workbook = XLSX.utils.book_new();
      const summary = XLSX.utils.aoa_to_sheet([
        ["Project", project?.name || ""],
        ["Project Code", project?.project_code || "—"],
        ["Client", project?.clients?.name || "—"],
        ["Activity Type", appliedActivityFilters.type],
        [
          "Employee",
          employeeOptions.find(
            (employee) => employee.id === appliedActivityFilters.employee,
          )?.name || "All employees",
        ],
        ["From Date", appliedActivityFilters.fromDate || "All dates"],
        ["To Date", appliedActivityFilters.toDate || "All dates"],
        ["Search", appliedActivityFilters.search || "—"],
        ["Result Count", activityTransactions.length],
      ]);
      summary["!cols"] = [{ wch: 20 }, { wch: 44 }];
      XLSX.utils.book_append_sheet(workbook, summary, "Summary");
      XLSX.utils.book_append_sheet(workbook, worksheet, "Wallet Activity");
      XLSX.writeFile(
        workbook,
        `Wallet_Activity_${project?.project_code || projectId}.xlsx`
      );
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f8fafc] px-5 py-7 sm:px-8">
        <div className="mx-auto max-w-[1500px]">
          <div className="rounded-3xl bg-white p-12 text-center shadow-sm ring-1 ring-slate-200">
            <p className="font-semibold text-slate-500">
              Loading Service Wallet...
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!project || !wallet) {
    return (
      <main className="min-h-screen bg-[#f8fafc] px-5 py-7 sm:px-8">
        <div className="mx-auto max-w-[1500px]">
          <div className="rounded-3xl bg-white p-12 text-center shadow-sm ring-1 ring-slate-200">
            <p className="font-semibold text-red-600">
              Project could not be loaded.
            </p>

            {errorMessage && (
              <p className="mt-2 text-sm text-slate-500">
                {errorMessage}
              </p>
            )}

            <Link
              href="/accounts?tab=projects"
              className="mt-6 inline-flex rounded-xl border border-slate-200 px-5 py-3 font-bold text-[#153E90]"
            >
              Back to Projects
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f8fafc] px-5 py-7 sm:px-8">
      <div className="mx-auto max-w-[1500px]">
        <Link
          href="/accounts?tab=projects"
          className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition hover:-translate-x-0.5 hover:text-[#153E90]"
        >
          ← Back to Projects
        </Link>

        <section className="relative min-h-[250px] overflow-hidden rounded-[2rem] bg-gradient-to-r from-[#0F172A] via-[#172554] to-[#153E90] p-8 text-white shadow-xl shadow-slate-300/50 lg:p-12">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-blue-400/10 blur-3xl" />
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-blue-100 ring-1 ring-white/15 backdrop-blur-sm">
                  {project.project_code || "No Code"}
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${
                    project.status === "active"
                      ? "bg-emerald-400/15 text-emerald-200 ring-1 ring-emerald-300/20"
                      : "bg-rose-400/15 text-rose-200 ring-1 ring-rose-300/20"
                  }`}
                >
                  {project.status}
                </span>
              </div>
              <h1 className="mt-5 text-3xl font-black tracking-tight text-white sm:text-4xl">
                {project.name}
              </h1>
              {project.clients?.id ? (
                <Link
                  href={`/clients/${project.clients.id}`}
                  className="mt-3 inline-flex text-sm font-semibold text-blue-100/80 transition hover:text-white hover:underline"
                >
                  Client: {project.clients.name}
                </Link>
              ) : (
                <p className="mt-3 text-sm font-semibold text-blue-100/80">
                  Client: No client
                </p>
              )}
            </div>

            <div className="relative flex flex-wrap gap-3">
              {canAdjustWallet ? (
                <button
                  type="button"
                  onClick={() =>
                    router.push(`/projects/${project.id}?action=hours`)
                  }
                  className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-[#153E90] shadow-lg shadow-slate-950/20 transition hover:bg-blue-50"
                >
                  Wallet Adjustment
                </button>
              ) : null}
              <button
                type="button"
                onClick={loadWallet}
                className="rounded-xl border border-white/25 bg-white/10 px-5 py-3 text-sm font-bold text-white shadow-sm backdrop-blur-sm transition hover:bg-white/20"
              >
                Refresh
              </button>
            </div>
          </div>
        </section>

        <section className="relative mt-6 overflow-hidden rounded-[2rem] border border-blue-100 bg-gradient-to-br from-white via-blue-50/35 to-cyan-50/60 p-7 shadow-[0_22px_55px_-34px_rgba(21,62,144,0.45)] lg:p-9">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#153E90] via-blue-500 to-cyan-400" />
          <div className="flex flex-col gap-8 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#153E90]">
                Service Wallet
              </p>
              <p className="mt-6 text-sm font-bold text-slate-500">
                Available Hours
              </p>
              <div className="mt-2 flex flex-wrap items-end gap-3">
                <p className="text-5xl font-black tracking-tight text-[#153E90] sm:text-6xl">
                  {formatHours(wallet.remaining_hours)}
                </p>
                <p className="pb-2 text-lg font-bold text-slate-500">hrs</p>
              </div>
              <p className="mt-3 text-sm text-slate-500">
                Hours currently available for project work
              </p>
            </div>

            <div className="xl:text-right">
              <span
                className={`inline-flex rounded-full px-4 py-2 text-sm font-black ${walletHealth.className}`}
              >
                {walletHealth.label}
              </span>
              <p className="mt-3 max-w-sm text-sm leading-6 text-slate-500">
                {walletHealth.description}
              </p>
            </div>
          </div>

          <div className="mt-9">
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="font-bold text-slate-600">Wallet balance</span>
              <span className="font-black text-[#153E90]">
                {percentageRemaining.toFixed(1)}% remaining
              </span>
            </div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-[#EEF2F7] ring-1 ring-slate-200/70">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#153E90] to-cyan-400 transition-all duration-700 ease-out"
                style={{ width: `${percentageRemaining}%` }}
              />
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-5">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
                Purchased
              </p>
              <p className="mt-2 text-2xl font-black text-emerald-900">
                {formatHours(wallet.purchased_hours)} hrs
              </p>
              <p className="mt-1 text-sm text-emerald-800/70">
                Lifetime service hours credited
              </p>
            </div>
            <div className="rounded-2xl border border-rose-100 bg-rose-50/70 p-5">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-rose-700">
                Consumed
              </p>
              <p className="mt-2 text-2xl font-black text-rose-900">
                {formatHours(wallet.used_hours)} hrs
              </p>
              <p className="mt-1 text-sm text-rose-800/70">
                Lifetime service hours used
              </p>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <article className="relative overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-br from-white to-cyan-50/60 p-6 shadow-sm">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#153E90] to-cyan-400" />
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Average Daily Usage</p>
                <p className="mt-4 text-3xl font-black text-[#153E90]">{formatHours(averageDailyUsage)}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-[#153E90]">
                <TimeOffIcon name="chart" className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-500">Hours per day over the last 30 days</p>
          </article>

          <article className="relative overflow-hidden rounded-3xl border border-amber-100 bg-gradient-to-br from-white to-amber-50/70 p-6 shadow-sm">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-500 to-yellow-300" />
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Estimated Depletion</p>
                <p className="mt-4 text-3xl font-black text-amber-800">
                  {estimatedDepletionDate
                    ? formatTimestampDate(estimatedDepletionDate.toISOString())
                    : averageDailyUsage <= 0
                      ? "No forecast"
                      : "Depleted"}
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                <TimeOffIcon name="clock" className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              {estimatedDaysRemaining === null
                ? "More usage data is required"
                : estimatedDaysRemaining === 0
                  ? "No hours are currently available"
                  : `Approximately ${estimatedDaysRemaining} days remaining`}
            </p>
          </article>

          <article className="relative overflow-hidden rounded-3xl border border-emerald-100 bg-gradient-to-br from-white to-emerald-50/70 p-6 shadow-sm md:col-span-2 xl:col-span-1">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-600 to-teal-300" />
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Recommended Recharge</p>
                <p className="mt-4 text-3xl font-black text-emerald-800">
                  {recommendedRecharge > 0
                    ? `${formatHours(recommendedRecharge)} hrs`
                    : "Not available"}
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <TimeOffIcon name="wallet" className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-500">Suggested hours for approximately 30 days</p>
          </article>
        </section>

        <section className="mt-8 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-gradient-to-r from-blue-50/80 via-white to-cyan-50/60 px-6 py-6 sm:px-8">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#153E90]">Wallet Activity</p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">Search project wallet history</h2>
            <p className="mt-1 text-sm text-slate-500">Choose filters and click Search to view purchased, consumed and adjusted hours.</p>
          </div>

          <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 sm:p-8">
            <label className="space-y-2 text-sm font-bold text-slate-700">
              <span>Activity Type</span>
              <select
                value={activityFilters.type}
                onChange={(event) =>
                  setActivityFilters((current) => ({ ...current, type: event.target.value as WalletFilter }))
                }
                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              >
                <option value="all">All activity</option>
                <option value="credits">Credits</option>
                <option value="usage">Usage</option>
                <option value="invoices">Invoices</option>
                <option value="adjustments">Adjustments</option>
              </select>
            </label>

            <label className="space-y-2 text-sm font-bold text-slate-700">
              <span>Employee</span>
              <select
                value={activityFilters.employee}
                onChange={(event) => setActivityFilters((current) => ({ ...current, employee: event.target.value }))}
                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              >
                <option value="all">All employees</option>
                {employeeOptions.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm font-bold text-slate-700">
              <span>From Date</span>
              <input
                type="date"
                value={activityFilters.fromDate}
                onChange={(event) => setActivityFilters((current) => ({ ...current, fromDate: event.target.value }))}
                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              />
            </label>

            <label className="space-y-2 text-sm font-bold text-slate-700">
              <span>To Date</span>
              <input
                type="date"
                value={activityFilters.toDate}
                onChange={(event) => setActivityFilters((current) => ({ ...current, toDate: event.target.value }))}
                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              />
            </label>

            <label className="space-y-2 text-sm font-bold text-slate-700 sm:col-span-2 lg:col-span-2 xl:col-span-1">
              <span>Search Activity</span>
              <input
                value={activityFilters.search}
                onChange={(event) => setActivityFilters((current) => ({ ...current, search: event.target.value }))}
                placeholder="Description, employee or invoice"
                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 px-6 py-5 sm:px-8">
            <button
              type="button"
              disabled={activityLoading}
              onClick={() => void searchActivity()}
              className="rounded-xl bg-[#153E90] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-900/15 transition hover:bg-blue-800"
            >
              {activityLoading ? "Searching..." : "Search"}
            </button>
            <button
              type="button"
              onClick={() => {
                setActivityFilters(emptyWalletActivityFilters);
                setAppliedActivityFilters(null);
                setActivityTransactions([]);
                setActivityError("");
              }}
              className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
            >
              Reset
            </button>
            <button
              type="button"
              disabled={!appliedActivityFilters || !activityTransactions.length || exporting}
              onClick={() => void downloadActivityExcel()}
              className="rounded-xl border border-blue-200 bg-blue-50 px-6 py-3 text-sm font-bold text-[#153E90] transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
            >
              {exporting ? "Downloading..." : "Download Excel"}
            </button>
            {appliedActivityFilters ? (
              <span className="ml-auto text-sm font-bold text-slate-500">{activityTransactions.length} results</span>
            ) : null}
          </div>

          {!appliedActivityFilters ? (
            <div className="border-t border-slate-100 px-6 py-14 text-center sm:px-8">
              <p className="font-bold text-slate-700">Wallet activity is ready to search</p>
              <p className="mt-2 text-sm text-slate-500">Apply one or more filters, then click Search.</p>
            </div>
          ) : activityError ? (
            <div className="border-t border-slate-100 px-6 py-14 text-center sm:px-8">
              <p className="font-bold text-rose-700">Unable to load wallet activity</p>
              <p className="mt-2 text-sm text-slate-500">{activityError}</p>
            </div>
          ) : activityTransactions.length ? (
            <div className="overflow-x-auto border-t border-slate-100">
              <table className="min-w-[1180px] w-full text-left text-sm">
                <thead className="bg-[#0F172A] text-xs font-black uppercase tracking-[0.12em] text-slate-200">
                  <tr>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-5 py-4">Start Time</th>
                    <th className="px-5 py-4">Stop Time</th>
                    <th className="px-5 py-4">Type</th>
                    <th className="px-5 py-4">Employee</th>
                    <th className="px-5 py-4">Description</th>
                    <th className="px-5 py-4 text-right">Hours</th>
                    <th className="px-5 py-4 text-right">Balance After</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activityTransactions.map((transaction) => {
                    const positive = Number(transaction.hours_delta || 0) > 0;
                    const badge = getTransactionBadge(transaction.transaction_type);
                    return (
                      <tr key={transaction.id} className="transition hover:bg-blue-50/40">
                        <td className="whitespace-nowrap px-6 py-4 font-semibold text-slate-700">
                          {formatDateKey(walletActivityDateKey(transaction))}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 font-semibold text-slate-600">
                          {transaction.time_entries?.started_at
                            ? formatTime(transaction.time_entries.started_at)
                            : "—"}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 font-semibold text-slate-600">
                          {transaction.time_entries?.stopped_at
                            ? formatTime(transaction.time_entries.stopped_at)
                            : "—"}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${badge.className}`}>{badge.text}</span>
                        </td>
                        <td className="px-5 py-4 font-semibold text-slate-700">{transaction.time_entries?.employees?.name || "—"}</td>
                        <td className="max-w-md px-5 py-4 text-slate-600">{getTransactionDescription(transaction)}</td>
                        <td className={`whitespace-nowrap px-5 py-4 text-right font-black ${positive ? "text-emerald-700" : "text-rose-700"}`}>
                          {positive ? "+" : ""}{formatHours(transaction.hours_delta)} hrs
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-right font-black text-slate-900">{formatHours(transaction.balance_after)} hrs</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="border-t border-slate-100 px-6 py-14 text-center sm:px-8">
              <p className="font-bold text-slate-700">No wallet activity found</p>
              <p className="mt-2 text-sm text-slate-500">Try changing or resetting the selected filters.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { formatDecimalHours } from "@/lib/format-hours";

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

type WalletTransaction = {
  id: string;
  project_id: string;
  invoice_id: string | null;
  invoice_item_id: string | null;
  payment_id: string | null;
  time_entry_id: string | null;
  transaction_type: string;
  hours_delta: number;
  notes: string | null;
  created_at: string;

  invoices: {
    invoice_number: string;
  } | null;

  time_entries: {
    description: string | null;

    employees: {
      name: string;
    } | null;
  } | null;
};

type TransactionWithBalance = WalletTransaction & {
  balance_after: number;
};

type WalletFilter =
  | "all"
  | "credits"
  | "usage"
  | "adjustments"
  | "invoices";

type WalletActivityFilters = {
  type: WalletFilter;
  employee: string;
  fromDate: string;
  toDate: string;
  search: string;
};

const emptyActivityFilters: WalletActivityFilters = {
  type: "all",
  employee: "all",
  fromDate: "",
  toDate: "",
  search: "",
};

function WalletMetricIcon({ children }: { children: string }) {
  return (
    <span aria-hidden="true" className="text-lg font-black leading-none">
      {children}
    </span>
  );
}

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
    useState<WalletActivityFilters>(emptyActivityFilters);
  const [appliedActivityFilters, setAppliedActivityFilters] =
    useState<WalletActivityFilters | null>(null);
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

  function formatDate(date: string) {
    return new Date(date)
      .toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
      .replace(/ /g, "-");
  }

  function formatTime(date: string) {
    return new Date(date).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getTransactionTitle(
    transaction: WalletTransaction
  ) {
    if (
      transaction.transaction_type === "invoice_credit" &&
      transaction.invoices?.invoice_number
    ) {
      return `Invoice #${transaction.invoices.invoice_number}`;
    }

    if (
      transaction.transaction_type === "time_debit" &&
      transaction.time_entries?.employees?.name
    ) {
      return transaction.time_entries.employees.name;
    }

    switch (transaction.transaction_type) {
      case "opening_credit":
        return "Opening Balance";

      case "invoice_credit":
        return "Invoice Credit";

      case "time_debit":
        return "Hours Consumed";

      case "manual_credit":
        return "Manual Credit";

      case "manual_debit":
        return "Manual Debit";

      case "adjustment":
        return "Wallet Adjustment";

      case "refund":
        return "Refund";

      default:
        return "Wallet Transaction";
    }
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

  function getTransactionReference(transaction: WalletTransaction) {
    if (transaction.invoices?.invoice_number) {
      return `Invoice #${transaction.invoices.invoice_number}`;
    }

    if (transaction.time_entry_id) {
      return `Time entry ${transaction.time_entry_id.slice(0, 8)}`;
    }

    return "—";
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
          description,
          employees(
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

  const transactionsWithBalance =
    useMemo<TransactionWithBalance[]>(() => {
      return transactions.reduce<{
        balance: number;
        rows: TransactionWithBalance[];
      }>(
        (result, transaction) => ({
          balance:
            result.balance - Number(transaction.hours_delta || 0),
          rows: [
            ...result.rows,
            { ...transaction, balance_after: result.balance },
          ],
        }),
        {
          balance: Number(wallet?.remaining_hours || 0),
          rows: [],
        }
      ).rows;
    }, [transactions, wallet]);

  const employeeOptions = useMemo(
    () =>
      Array.from(
        new Set(
          transactionsWithBalance
            .map(
              (transaction) =>
                transaction.time_entries?.employees?.name
            )
            .filter((name): name is string => Boolean(name))
        )
      ).sort((left, right) => left.localeCompare(right)),
    [transactionsWithBalance]
  );

  const filteredTransactions = useMemo(() => {
    if (!appliedActivityFilters) return [];

    let result = transactionsWithBalance;
    const filter = appliedActivityFilters.type;

    if (filter === "credits") {
      result = result.filter(
        (transaction) =>
          Number(transaction.hours_delta || 0) > 0
      );
    }

    if (filter === "usage") {
      result = result.filter(
        (transaction) =>
          transaction.transaction_type === "time_debit"
      );
    }

    if (filter === "adjustments") {
      result = result.filter((transaction) =>
        [
          "manual_credit",
          "manual_debit",
          "adjustment",
          "refund",
        ].includes(transaction.transaction_type)
      );
    }

    if (filter === "invoices") {
      result = result.filter(
        (transaction) =>
          transaction.transaction_type === "invoice_credit"
      );
    }

    if (appliedActivityFilters.employee !== "all") {
      result = result.filter(
        (transaction) =>
          transaction.time_entries?.employees?.name ===
          appliedActivityFilters.employee
      );
    }

    if (appliedActivityFilters.fromDate) {
      const fromDate = new Date(`${appliedActivityFilters.fromDate}T00:00:00`);
      result = result.filter(
        (transaction) => new Date(transaction.created_at) >= fromDate
      );
    }

    if (appliedActivityFilters.toDate) {
      const toDate = new Date(`${appliedActivityFilters.toDate}T23:59:59.999`);
      result = result.filter(
        (transaction) => new Date(transaction.created_at) <= toDate
      );
    }

    const normalizedSearch = appliedActivityFilters.search
      .trim()
      .toLowerCase();

    if (normalizedSearch) {
      result = result.filter((transaction) => {
        const searchableText = [
          getTransactionTitle(transaction),
          getTransactionDescription(transaction),
          transaction.invoices?.invoice_number || "",
          transaction.time_entries?.employees?.name || "",
          transaction.transaction_type,
        ]
          .join(" ")
          .toLowerCase();

        return searchableText.includes(normalizedSearch);
      });
    }

    return result;
  }, [appliedActivityFilters, transactionsWithBalance]);

  async function downloadActivityExcel() {
    if (!appliedActivityFilters || !filteredTransactions.length) return;

    setExporting(true);

    try {
      const XLSX = await import("xlsx");
      const rows = filteredTransactions.map((transaction) => ({
        "Date / Time": `${formatDate(transaction.created_at)} ${formatTime(
          transaction.created_at
        )}`,
        Type: getTransactionBadge(transaction.transaction_type).text,
        Employee:
          transaction.time_entries?.employees?.name || "System",
        Description: getTransactionDescription(transaction),
        Hours: Number(transaction.hours_delta || 0),
        "Balance After": Number(transaction.balance_after || 0),
        Reference: getTransactionReference(transaction),
      }));
      const worksheet = XLSX.utils.json_to_sheet(rows);
      worksheet["!cols"] = [
        { wch: 22 },
        { wch: 18 },
        { wch: 24 },
        { wch: 44 },
        { wch: 12 },
        { wch: 16 },
        { wch: 24 },
      ];
      const workbook = XLSX.utils.book_new();
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

        <section className="overflow-hidden rounded-[2rem] border border-slate-200/80 bg-gradient-to-br from-white via-white to-blue-50/60 p-7 shadow-[0_18px_45px_-28px_rgba(15,23,42,0.35)] lg:p-9">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-[#153E90] ring-1 ring-blue-100">
                  {project.project_code || "No Code"}
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${
                    project.status === "active"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-rose-100 text-rose-700"
                  }`}
                >
                  {project.status}
                </span>
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                {project.name}
              </h1>
              {project.clients?.id ? (
                <Link
                  href={`/clients/${project.clients.id}`}
                  className="mt-2 inline-flex text-sm font-semibold text-slate-500 hover:text-[#153E90] hover:underline"
                >
                  Client: {project.clients.name}
                </Link>
              ) : (
                <p className="mt-2 text-sm font-semibold text-slate-500">
                  Client: No client
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              {canAdjustWallet ? (
                <button
                  type="button"
                  onClick={() =>
                    router.push(`/projects/${project.id}?action=hours`)
                  }
                  className="rounded-xl bg-[#153E90] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-900/15 transition hover:bg-blue-800"
                >
                  Wallet Adjustment
                </button>
              ) : null}
              <button
                type="button"
                onClick={loadWallet}
                className="rounded-xl border border-blue-200 bg-white px-5 py-3 text-sm font-bold text-[#153E90] shadow-sm transition hover:bg-blue-50"
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
                <WalletMetricIcon>↗</WalletMetricIcon>
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
                    ? formatDate(estimatedDepletionDate.toISOString())
                    : averageDailyUsage <= 0
                      ? "No forecast"
                      : "Depleted"}
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                <WalletMetricIcon>⌁</WalletMetricIcon>
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
                <WalletMetricIcon>+</WalletMetricIcon>
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
                {employeeOptions.map((employee) => <option key={employee} value={employee}>{employee}</option>)}
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
                placeholder="Description or reference"
                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 px-6 py-5 sm:px-8">
            <button
              type="button"
              onClick={() => setAppliedActivityFilters({ ...activityFilters })}
              className="rounded-xl bg-[#153E90] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-900/15 transition hover:bg-blue-800"
            >
              Search
            </button>
            <button
              type="button"
              onClick={() => {
                setActivityFilters(emptyActivityFilters);
                setAppliedActivityFilters(null);
              }}
              className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
            >
              Reset
            </button>
            <button
              type="button"
              disabled={!appliedActivityFilters || !filteredTransactions.length || exporting}
              onClick={() => void downloadActivityExcel()}
              className="rounded-xl border border-blue-200 bg-blue-50 px-6 py-3 text-sm font-bold text-[#153E90] transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
            >
              {exporting ? "Downloading..." : "Download Excel"}
            </button>
            {appliedActivityFilters ? (
              <span className="ml-auto text-sm font-bold text-slate-500">{filteredTransactions.length} results</span>
            ) : null}
          </div>

          {!appliedActivityFilters ? (
            <div className="border-t border-slate-100 px-6 py-14 text-center sm:px-8">
              <p className="font-bold text-slate-700">Wallet activity is ready to search</p>
              <p className="mt-2 text-sm text-slate-500">Apply one or more filters, then click Search.</p>
            </div>
          ) : filteredTransactions.length ? (
            <div className="overflow-x-auto border-t border-slate-100">
              <table className="min-w-[1120px] w-full text-left text-sm">
                <thead className="bg-[#0F172A] text-xs font-black uppercase tracking-[0.12em] text-slate-200">
                  <tr>
                    <th className="px-6 py-4">Date / Time</th>
                    <th className="px-5 py-4">Type</th>
                    <th className="px-5 py-4">Employee</th>
                    <th className="px-5 py-4">Description</th>
                    <th className="px-5 py-4 text-right">Hours</th>
                    <th className="px-5 py-4 text-right">Balance After</th>
                    <th className="px-6 py-4">Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTransactions.map((transaction) => {
                    const positive = Number(transaction.hours_delta || 0) > 0;
                    const badge = getTransactionBadge(transaction.transaction_type);
                    return (
                      <tr key={transaction.id} className="transition hover:bg-blue-50/40">
                        <td className="whitespace-nowrap px-6 py-4 font-semibold text-slate-700">
                          <span className="block">{formatDate(transaction.created_at)}</span>
                          <span className="mt-1 block text-xs text-slate-400">{formatTime(transaction.created_at)}</span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${badge.className}`}>{badge.text}</span>
                        </td>
                        <td className="px-5 py-4 font-semibold text-slate-700">{transaction.time_entries?.employees?.name || "System"}</td>
                        <td className="max-w-md px-5 py-4 text-slate-600">{getTransactionDescription(transaction)}</td>
                        <td className={`whitespace-nowrap px-5 py-4 text-right font-black ${positive ? "text-emerald-700" : "text-rose-700"}`}>
                          {positive ? "+" : ""}{formatHours(transaction.hours_delta)} hrs
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-right font-black text-slate-900">{formatHours(transaction.balance_after)} hrs</td>
                        <td className="whitespace-nowrap px-6 py-4 font-semibold text-[#153E90]">{getTransactionReference(transaction)}</td>
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

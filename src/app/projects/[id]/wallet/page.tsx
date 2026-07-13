"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

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

type TransactionGroup = {
  key: string;
  title: string;
  transactions: TransactionWithBalance[];
};

type WalletFilter =
  | "all"
  | "credits"
  | "usage"
  | "adjustments"
  | "invoices";

export default function ProjectWalletPage() {
  const params = useParams();
  const router = useRouter();

  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [wallet, setWallet] = useState<WalletSummary | null>(null);

  const [transactions, setTransactions] = useState<
    WalletTransaction[]
  >([]);

  const [filter, setFilter] = useState<WalletFilter>("all");
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  function formatHours(value: number) {
    return Number(value || 0).toFixed(2);
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

  function formatLongDate(date: string) {
    return new Date(date).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  }

  function formatTime(date: string) {
    return new Date(date).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getDateKey(date: string) {
    const value = new Date(date);

    return `${value.getFullYear()}-${String(
      value.getMonth() + 1
    ).padStart(2, "0")}-${String(value.getDate()).padStart(
      2,
      "0"
    )}`;
  }

  function getGroupTitle(date: string) {
    const transactionDate = new Date(date);
    transactionDate.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (transactionDate.getTime() === today.getTime()) {
      return "Today";
    }

    if (transactionDate.getTime() === yesterday.getTime()) {
      return "Yesterday";
    }

    return formatLongDate(date);
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
          className: "bg-green-100 text-green-700",
        };

      case "time_debit":
        return {
          text: "Usage",
          className: "bg-red-100 text-red-700",
        };

      case "manual_credit":
        return {
          text: "Manual Credit",
          className: "bg-blue-100 text-blue-700",
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
      setTransactions(
        (transactionData || []).map((item: any) => ({
          ...item,
          hours_delta: Number(item.hours_delta || 0),
        })) as WalletTransaction[]
      );
    }

    setLoading(false);
  }

  useEffect(() => {
    if (projectId) {
      loadWallet();
    }
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
      let runningBalance = Number(
        wallet?.remaining_hours || 0
      );

      return transactions.map((transaction) => {
        const result = {
          ...transaction,
          balance_after: runningBalance,
        };

        runningBalance -= Number(
          transaction.hours_delta || 0
        );

        return result;
      });
    }, [transactions, wallet]);

  const filteredTransactions = useMemo(() => {
    let result = transactionsWithBalance;

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

    const normalizedSearch = search.trim().toLowerCase();

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
  }, [filter, search, transactionsWithBalance]);

  const groupedTransactions = useMemo<TransactionGroup[]>(() => {
    const groups = new Map<string, TransactionGroup>();

    filteredTransactions.forEach((transaction) => {
      const key = getDateKey(transaction.created_at);

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          title: getGroupTitle(transaction.created_at),
          transactions: [],
        });
      }

      groups.get(key)?.transactions.push(transaction);
    });

    return Array.from(groups.values());
  }, [filteredTransactions]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f8fafc] px-8 py-7">
        <div className="mx-auto max-w-6xl">
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
      <main className="min-h-screen bg-[#f8fafc] px-8 py-7">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-3xl bg-white p-12 text-center shadow-sm ring-1 ring-slate-200">
            <p className="font-semibold text-red-600">
              Project could not be loaded.
            </p>

            {errorMessage && (
              <p className="mt-2 text-sm text-slate-500">
                {errorMessage}
              </p>
            )}

            <button
              type="button"
              onClick={() =>
                router.push("/projects")
              }
              className="mt-6 rounded-xl border px-5 py-3 font-bold"
            >
              Back to Projects
            </button>
          </div>
        </div>
      </main>
    );
  }
    return (
    <main className="min-h-screen bg-[#f8fafc] px-8 py-7">
      <div className="mx-auto max-w-6xl">
        <button
          type="button"
          onClick={() =>
            router.push("/projects")
          }
          className="mb-6 text-sm font-semibold text-slate-500 transition hover:-translate-x-0.5 hover:text-[#153E90]"
        >
          ← Back to Projects
        </button>

        <div className="relative overflow-hidden rounded-[2rem] bg-[#0F172A] p-8 text-white shadow-xl shadow-slate-300/50 lg:p-10">
          <div className="absolute -right-24 -top-28 h-80 w-80 rounded-full bg-[#153E90]/60 blur-3xl" />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm font-semibold text-blue-200">
                [{project.project_code || "No Code"}]
              </p>

              <span
                className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${
                  project.status === "active"
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {project.status}
              </span>
            </div>

            <h1 className="mt-2 text-4xl font-bold tracking-tight text-white lg:text-5xl">
              {project.name}
            </h1>

            <button
              type="button"
              onClick={() => {
                if (project.clients?.id) {
                  router.push(
                    `/clients/${project.clients.id}`
                  );
                }
              }}
              className="mt-2 text-sm font-semibold text-slate-300 hover:text-white hover:underline"
            >
              Client: {project.clients?.name || "No client"}
            </button>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() =>
                router.push(
                  `/projects/${project.id}?action=hours`
                )
              }
              className="rounded-2xl bg-white px-5 py-3 text-sm font-bold text-[#0F172A] shadow-lg"
            >
              Wallet Adjustment
            </button>

            <button
              type="button"
              onClick={loadWallet}
              className="rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-bold text-white hover:bg-white/15"
            >
              Refresh
            </button>
          </div>
          </div>
        </div>

        {/* SERVICE WALLET */}

        <div className="relative z-10 -mt-4 overflow-hidden rounded-3xl bg-gradient-to-br from-[#153E90] to-[#0F172A] text-white shadow-xl shadow-slate-300/50 sm:mx-5">
          <div className="p-8">
            <div className="flex items-start justify-between gap-6">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-300">
                  Service Wallet
                </p>

                <p className="mt-5 text-sm font-semibold text-slate-300">
                  Available Hours
                </p>

                <div className="mt-2 flex items-end gap-3">
                  <p className="text-6xl font-bold">
                    {formatHours(wallet.remaining_hours)}
                  </p>

                  <p className="pb-2 text-xl font-semibold text-slate-300">
                    hrs
                  </p>
                </div>

                <p className="mt-3 text-sm text-slate-400">
                  Hours currently available for project work
                </p>
              </div>

              <div className="text-right">
                <span
                  className={`inline-flex rounded-full px-4 py-2 text-sm font-bold ${walletHealth.className}`}
                >
                  {walletHealth.label}
                </span>

                <p className="mt-3 max-w-xs text-sm text-slate-400">
                  {walletHealth.description}
                </p>
              </div>
            </div>

            <div className="mt-8">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-300">
                  Wallet balance
                </span>

                <span className="font-bold">
                  {percentageRemaining.toFixed(1)}% remaining
                </span>
              </div>

              <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-700">
                <div
                  className="h-full rounded-full bg-white transition-all"
                  style={{
                    width: `${percentageRemaining}%`,
                  }}
                />
              </div>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-8 border-t border-slate-700 pt-8">
              <div>
                <p className="text-sm font-semibold text-slate-400">
                  Purchased
                </p>

                <p className="mt-2 text-3xl font-bold">
                  {formatHours(wallet.purchased_hours)} hrs
                </p>

                <p className="mt-2 text-sm text-slate-400">
                  Lifetime service hours credited
                </p>
              </div>

              <div className="border-l border-slate-700 pl-8">
                <p className="text-sm font-semibold text-slate-400">
                  Consumed
                </p>

                <p className="mt-2 text-3xl font-bold">
                  {formatHours(wallet.used_hours)} hrs
                </p>

                <p className="mt-2 text-sm text-slate-400">
                  Lifetime service hours used
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* FORECAST */}

        <div className="mt-6 grid grid-cols-3 gap-6">
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm font-semibold text-slate-500">
              Average Daily Usage
            </p>

            <p className="mt-3 text-3xl font-bold text-slate-950">
              {formatHours(averageDailyUsage)}
            </p>

            <p className="mt-2 text-sm text-slate-500">
              Hours per day over the last 30 days
            </p>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm font-semibold text-slate-500">
              Estimated Depletion
            </p>

            <p className="mt-3 text-3xl font-bold text-slate-950">
              {estimatedDepletionDate
                ? formatDate(
                    estimatedDepletionDate.toISOString()
                  )
                : averageDailyUsage <= 0
                ? "No forecast"
                : "Depleted"}
            </p>

            <p className="mt-2 text-sm text-slate-500">
              {estimatedDaysRemaining === null
                ? "More usage data is required"
                : estimatedDaysRemaining === 0
                ? "No hours are currently available"
                : `Approximately ${estimatedDaysRemaining} days remaining`}
            </p>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm font-semibold text-slate-500">
              Recommended Recharge
            </p>

            <p className="mt-3 text-3xl font-bold text-slate-950">
              {recommendedRecharge > 0
                ? `${formatHours(recommendedRecharge)} hrs`
                : "Not available"}
            </p>

            <p className="mt-2 text-sm text-slate-500">
              Suggested hours for approximately 30 days
            </p>
          </div>
        </div>

        {/* TIMELINE HEADER */}

        <div className="mt-10">
          <div className="flex items-end justify-between gap-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-950">
                Timeline
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Complete history of purchased, consumed and
                adjusted hours.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search activity..."
                className="w-64 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm outline-none focus:border-slate-400"
              />

              <div className="flex gap-1 rounded-2xl bg-white p-1 shadow-sm ring-1 ring-slate-200">
                {[
                  {
                    value: "all",
                    label: "All",
                  },
                  {
                    value: "credits",
                    label: "Credits",
                  },
                  {
                    value: "usage",
                    label: "Usage",
                  },
                  {
                    value: "invoices",
                    label: "Invoices",
                  },
                  {
                    value: "adjustments",
                    label: "Adjustments",
                  },
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() =>
                      setFilter(item.value as WalletFilter)
                    }
                    className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                      filter === item.value
                        ? "bg-slate-950 text-white"
                        : "text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* TIMELINE GROUPS */}

        <div className="mt-6 space-y-8">
          {groupedTransactions.length ? (
            groupedTransactions.map((group) => (
              <section key={group.key}>
                <div className="mb-3 flex items-center gap-4">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
                    {group.title}
                  </h3>

                  <div className="h-px flex-1 bg-slate-200" />
                </div>

                <div className="space-y-3">
                  {group.transactions.map((transaction) => {
                    const positive =
                      Number(transaction.hours_delta || 0) > 0;

                    const badge = getTransactionBadge(
                      transaction.transaction_type
                    );

                    return (
                      <div
                        key={transaction.id}
                        className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 transition hover:shadow-md"
                      >
                        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-5">
                          <div
                            className={`flex h-12 w-12 items-center justify-center rounded-2xl text-xl font-bold ${
                              positive
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {positive ? "+" : "−"}
                          </div>

                          <div>
                            <div className="flex flex-wrap items-center gap-3">
                              <p className="text-lg font-bold text-slate-950">
                                {getTransactionTitle(transaction)}
                              </p>

                              <span
                                className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${badge.className}`}
                              >
                                {badge.text}
                              </span>
                            </div>

                            <p className="mt-2 text-sm text-slate-600">
                              {getTransactionDescription(
                                transaction
                              )}
                            </p>

                            <p className="mt-2 text-xs font-semibold text-slate-400">
                              {formatTime(transaction.created_at)}
                            </p>
                          </div>

                          <div className="min-w-48 text-right">
                            <p
                              className={`text-2xl font-bold ${
                                positive
                                  ? "text-green-700"
                                  : "text-red-700"
                              }`}
                            >
                              {positive ? "+" : ""}
                              {formatHours(
                                transaction.hours_delta
                              )}{" "}
                              hrs
                            </p>

                            <p className="mt-2 text-xs font-semibold text-slate-500">
                              Balance after transaction
                            </p>

                            <p className="mt-1 font-bold text-slate-950">
                              {formatHours(
                                transaction.balance_after
                              )}{" "}
                              hrs
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))
          ) : (
            <div className="rounded-3xl bg-white p-12 text-center shadow-sm ring-1 ring-slate-200">
              <p className="font-semibold text-slate-500">
                No wallet transactions match the selected
                filters.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

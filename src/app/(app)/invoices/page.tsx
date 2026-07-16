"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/lib/supabase";
import { RecurringInvoicesWorkspace } from "./recurring/page";

type InvoiceTab = "overview" | "all" | "recurring";
type Invoice = {
  id: string;
  invoice_number: number;
  client_id: string;
  issue_date: string;
  due_date: string;
  currency: string;
  total_amount: number;
  paid_amount: number | null;
  status: string;
  generated_from_recurring: boolean;
  clients: { name: string } | null;
};
type Client = { id: string; name: string };
type Kpi = {
  currency: string;
  open_amount: number;
  paid_amount: number;
  overdue_count: number;
  overdue_amount: number;
  invoices_in_year: number;
};
type Monthly = {
  month_number: number;
  month: string;
  currency: string;
  open_amount: number;
  paid_amount: number;
  total_invoiced: number;
  invoice_count: number;
};
type Dimension = {
  invoice_year: number;
  currency: string;
  invoice_count: number;
};
type RpcRow = Record<string, unknown>;

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const PAGE_SIZE = 10;

function money(currency: string, value: number) {
  return `${currency} ${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}
function statusStyle(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "paid")
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (normalized === "overdue") return "bg-red-50 text-red-700 ring-red-200";
  if (normalized === "sent") return "bg-blue-50 text-[#153E90] ring-blue-200";
  if (normalized === "void" || normalized === "cancelled")
    return "bg-slate-100 text-slate-500 ring-slate-200";
  return "bg-amber-50 text-amber-700 ring-amber-200";
}
function dueStatus(invoice: Invoice) {
  const status = invoice.status.toLowerCase();
  if (status === "paid") return { label: "Paid", style: "text-emerald-700" };
  if (["void", "cancelled"].includes(status))
    return { label: "Not applicable", style: "text-slate-400" };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${invoice.due_date}T00:00:00`);
  due.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (days > 0)
    return {
      label: `Due in ${days} day${days === 1 ? "" : "s"}`,
      style: "text-blue-700",
    };
  if (days === 0) return { label: "Due today", style: "text-amber-700" };
  return {
    label: `${Math.abs(days)} day${days === -1 ? "" : "s"} late`,
    style: "text-red-700",
  };
}
function dateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}
function periodRange(period: string) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const range = (start: Date, end: Date) => ({
    start: dateInput(start),
    end: dateInput(end),
  });
  if (period === "this_month")
    return range(new Date(year, month, 1), new Date(year, month + 1, 0));
  if (period === "last_month")
    return range(new Date(year, month - 1, 1), new Date(year, month, 0));
  const quarter = Math.floor(month / 3);
  if (period === "this_quarter")
    return range(
      new Date(year, quarter * 3, 1),
      new Date(year, quarter * 3 + 3, 0),
    );
  if (period === "last_quarter") {
    const start = new Date(year, quarter * 3 - 3, 1);
    return range(start, new Date(start.getFullYear(), start.getMonth() + 3, 0));
  }
  if (period === "this_year")
    return range(new Date(year, 0, 1), new Date(year, 11, 31));
  if (period === "last_year")
    return range(new Date(year - 1, 0, 1), new Date(year - 1, 11, 31));
  return null;
}

function InvoiceTable({
  invoices,
  loading,
  onOpen,
}: {
  invoices: Invoice[];
  loading: boolean;
  onOpen: (id: string) => void;
}) {
  if (loading)
    return (
      <div className="rounded-3xl border border-slate-200 bg-white py-20 text-center text-sm font-medium text-slate-500">
        Loading invoices…
      </div>
    );
  return (
    <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[930px] border-collapse">
        <thead className="bg-slate-50">
          <tr>
            {[
              "Invoice #",
              "Client",
              "Issue Date",
              "Due Date",
              "Amount",
              "Status",
              "Payment Due",
            ].map((heading) => (
              <th
                key={heading}
                className="border-b border-slate-200 px-5 py-4 text-left text-[11px] font-bold uppercase tracking-[.14em] text-slate-500"
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {invoices.map((invoice) => {
            const due = dueStatus(invoice);
            return (
              <tr
                key={invoice.id}
                data-shortcut-row
                data-shortcut-href={`/invoices/${invoice.id}`}
                data-shortcut-edit-href={
                  invoice.status.toLowerCase() === "draft"
                    ? `/invoices/${invoice.id}/edit`
                    : undefined
                }
                onClick={() => onOpen(invoice.id)}
                className="cursor-pointer border-b border-slate-100 transition hover:bg-blue-50/30"
              >
                <td className="px-5 py-4">
                  <span className="font-bold text-slate-950">
                    #{invoice.invoice_number}
                  </span>
                  {invoice.generated_from_recurring ? (
                    <span className="ml-2 rounded-full bg-violet-50 px-2 py-1 text-[9px] font-bold uppercase text-violet-700">
                      Recurring
                    </span>
                  ) : null}
                </td>
                <td className="px-5 py-4 font-semibold text-slate-700">
                  {invoice.clients?.name || "—"}
                </td>
                <td className="px-5 py-4 text-sm text-slate-500">
                  {formatDate(invoice.issue_date)}
                </td>
                <td className="px-5 py-4 text-sm text-slate-500">
                  {formatDate(invoice.due_date)}
                </td>
                <td className="px-5 py-4 font-bold text-slate-900">
                  {money(invoice.currency, invoice.total_amount)}
                </td>
                <td className="px-5 py-4">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold capitalize ring-1 ${statusStyle(invoice.status)}`}
                  >
                    {invoice.status}
                  </span>
                </td>
                <td className={`px-5 py-4 text-sm font-semibold ${due.style}`}>
                  {due.label}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: Monthly }[];
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="min-w-56 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
      <p className="font-bold text-slate-950">{row.month}</p>
      <div className="mt-3 space-y-2 text-sm">
        <div className="flex justify-between gap-5 text-slate-500">
          <span>Open</span>
          <strong className="text-[#153E90]">
            {money(row.currency, row.open_amount)}
          </strong>
        </div>
        <div className="flex justify-between gap-5 text-slate-500">
          <span>Paid</span>
          <strong className="text-emerald-700">
            {money(row.currency, row.paid_amount)}
          </strong>
        </div>
        <div className="flex justify-between gap-5 border-t border-slate-100 pt-2 text-slate-500">
          <span>Total Invoiced</span>
          <strong className="text-slate-900">
            {money(row.currency, row.total_invoiced)}
          </strong>
        </div>
        <div className="flex justify-between gap-5 text-slate-500">
          <span>Invoice Count</span>
          <strong className="text-slate-900">{row.invoice_count}</strong>
        </div>
      </div>
    </div>
  );
}

function InvoicesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab");
  const [tab, setTab] = useState<InvoiceTab>(
    initialTab === "all" || initialTab === "recurring"
      ? initialTab
      : "overview",
  );
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(
    Number(searchParams.get("year")) || currentYear,
  );
  const [actualOverdueCount, setActualOverdueCount] = useState(0);
  const [chartCurrency, setChartCurrency] = useState(
    searchParams.get("currency") || "",
  );
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [monthly, setMonthly] = useState<Monthly[]>([]);
  const [recent, setRecent] = useState<Invoice[]>([]);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(true);
  const [error, setError] = useState("");
  const [chooserOpen, setChooserOpen] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientFilter, setClientFilter] = useState(
    searchParams.get("client") || "",
  );
  const [period, setPeriod] = useState(searchParams.get("period") || "all");
  const [statusFilter, setStatusFilter] = useState(
    searchParams.get("status") || "",
  );
  const [currencyFilter, setCurrencyFilter] = useState(
    searchParams.get("filterCurrency") || "",
  );
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [debouncedSearch, setDebouncedSearch] = useState(
    searchParams.get("q") || "",
  );
  const [customFrom, setCustomFrom] = useState(searchParams.get("from") || "");
  const [customTo, setCustomTo] = useState(searchParams.get("to") || "");
  const [page, setPage] = useState(
    Math.max(1, Number(searchParams.get("page")) || 1),
  );
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  const [invoiceCount, setInvoiceCount] = useState(0);
  const [tableLoading, setTableLoading] = useState(false);
  const filterMount = useRef(true);

  const updateUrl = useCallback(
    (nextTab: InvoiceTab, year = selectedYear, currency = chartCurrency) => {
      const params = new URLSearchParams(window.location.search);
      params.set("tab", nextTab);
      if (year) params.set("year", String(year));
      if (currency) params.set("currency", currency);
      router.replace(`/invoices?${params.toString()}`, {
        scroll: false,
      });
    },
    [chartCurrency, router, selectedYear],
  );
  function selectTab(next: InvoiceTab) {
    if (next === "all" && tab !== "all") {
      setStatusFilter("");
    }

    setTab(next);
    updateUrl(next);
  }

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedSearch(search.trim()),
      300,
    );
    return () => window.clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    if (!chooserOpen) return;
    function close(event: KeyboardEvent) {
      if (event.key === "Escape") setChooserOpen(false);
    }
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [chooserOpen]);
  useEffect(() => {
    async function loadBase() {
      const [dimensionResult, clientResult, recentResult] = await Promise.all([
        supabase.rpc("get_invoice_dashboard_dimensions"),
        supabase.from("clients").select("id,name").order("name"),
        supabase
          .from("invoices")
          .select(
            "id,invoice_number,client_id,issue_date,due_date,currency,total_amount,paid_amount,status,generated_from_recurring,clients(name)",
          )
          .in("status", ["draft", "sent", "overdue"])
          .order("due_date", { ascending: true })
          .order("invoice_number", { ascending: false })
          .limit(10),
      ]);
      if (dimensionResult.error) setError(dimensionResult.error.message);
      const dimensionRows = (dimensionResult.data || []) as RpcRow[];
      const loadedDimensions = dimensionRows.map((row) => ({
        ...row,
        invoice_year: Number(row.invoice_year),
        invoice_count: Number(row.invoice_count),
      })) as Dimension[];
      setDimensions(loadedDimensions);
      setClients((clientResult.data || []) as Client[]);
      setRecent((recentResult.data || []) as unknown as Invoice[]);
      if (!chartCurrency && loadedDimensions.length) {
        const yearRows = loadedDimensions
          .filter((row) => row.invoice_year === selectedYear)
          .sort((a, b) => b.invoice_count - a.invoice_count);
        setChartCurrency((yearRows[0] || loadedDimensions[0]).currency);
      }
    }
    void loadBase();
    // Dashboard dimensions, clients, and recent invoices are stable base data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    async function loadKpis() {
      setOverviewLoading(true);

      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());

      const [kpiResult, overdueResult] = await Promise.all([
        supabase.rpc("get_invoice_kpi_summary", {
          p_year: selectedYear,
        }),

        supabase
          .from("invoices")
          .select("id", { count: "exact", head: true })
          .in("status", ["sent", "overdue"])
          .lt("due_date", today),
      ]);

      if (kpiResult.error) {
        setError(kpiResult.error.message);
      }

      if (overdueResult.error) {
        setError(overdueResult.error.message);
      }

      const rows = (kpiResult.data || []) as RpcRow[];

      setKpis(
        rows.map((row) => ({
          ...row,
          open_amount: Number(row.open_amount),
          paid_amount: Number(row.paid_amount),
          overdue_count: Number(row.overdue_count),
          overdue_amount: Number(row.overdue_amount),
          invoices_in_year: Number(row.invoices_in_year),
        })) as Kpi[],
      );

      setActualOverdueCount(overdueResult.count || 0);
      setOverviewLoading(false);
    }
    void loadKpis();
  }, [selectedYear]);

  useEffect(() => {
    if (!chartCurrency) return;
    async function loadChart() {
      setChartLoading(true);
      const result = await supabase.rpc("get_invoice_monthly_summary", {
        p_year: selectedYear,
        p_currency: chartCurrency,
      });
      if (result.error) setError(result.error.message);
      const rows = (result.data || []) as RpcRow[];
      setMonthly(
        rows.map((row) => ({
          month_number: Number(row.month_number),
          month: `${MONTHS[Number(row.month_number) - 1]} ${selectedYear}`,
          currency: chartCurrency,
          open_amount: Number(row.open_amount),
          paid_amount: Number(row.paid_amount),
          total_invoiced: Number(row.total_invoiced),
          invoice_count: Number(row.invoice_count),
        })) as Monthly[],
      );
      setChartLoading(false);
    }
    void loadChart();
    updateUrl(tab, selectedYear, chartCurrency);
  }, [chartCurrency, selectedYear]);

  const loadAllInvoices = useCallback(async () => {
    setTableLoading(true);
    setError("");
    let matchingClientIds: string[] | null = null;
    const numericSearch = debouncedSearch.replace(/^#/, "");
    if (debouncedSearch && !/^\d+$/.test(numericSearch)) {
      const clientsResult = await supabase
        .from("clients")
        .select("id")
        .ilike("name", `%${debouncedSearch}%`);
      matchingClientIds = (clientsResult.data || []).map((client) => client.id);
    }
    let query = supabase
      .from("invoices")
      .select(
        "id,invoice_number,client_id,issue_date,due_date,currency,total_amount,paid_amount,status,generated_from_recurring,clients(name)",
        { count: "exact" },
      );
    if (clientFilter) query = query.eq("client_id", clientFilter);
    if (statusFilter === "open")
      query = query.in("status", ["draft", "sent", "overdue"]);
    else if (statusFilter === "overdue")
      query = query.in("status", ["sent", "overdue"]).lt(
        "due_date",
        new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Kolkata",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date()),
      );
    else if (statusFilter) query = query.eq("status", statusFilter);
    if (currencyFilter) query = query.eq("currency", currencyFilter);
    const range =
      period === "custom"
        ? customFrom || customTo
          ? { start: customFrom, end: customTo }
          : null
        : periodRange(period);
    if (range?.start) query = query.gte("issue_date", range.start);
    if (range?.end) query = query.lte("issue_date", range.end);
    if (debouncedSearch && /^\d+$/.test(numericSearch))
      query = query.eq("invoice_number", Number(numericSearch));
    else if (matchingClientIds) {
      if (!matchingClientIds.length) {
        setAllInvoices([]);
        setInvoiceCount(0);
        setTableLoading(false);
        return;
      }
      query = query.in("client_id", matchingClientIds);
    }
    const from = (page - 1) * PAGE_SIZE;
    const result = await query
      .order("invoice_number", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (result.error) setError(result.error.message);
    setAllInvoices((result.data || []) as unknown as Invoice[]);
    setInvoiceCount(result.count || 0);
    setTableLoading(false);
  }, [
    clientFilter,
    currencyFilter,
    customFrom,
    customTo,
    debouncedSearch,
    page,
    period,
    statusFilter,
  ]);
  useEffect(() => {
    if (tab === "all") void loadAllInvoices();
  }, [loadAllInvoices, tab]);
  useEffect(() => {
    if (filterMount.current) {
      filterMount.current = false;
      return;
    }
    setPage(1);
  }, [
    clientFilter,
    currencyFilter,
    customFrom,
    customTo,
    debouncedSearch,
    period,
    statusFilter,
  ]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set("tab", tab);
    params.set("year", String(selectedYear));
    if (chartCurrency) params.set("currency", chartCurrency);
    const values: Record<string, string> = {
      client: clientFilter,
      period,
      status: statusFilter,
      filterCurrency: currencyFilter,
      q: search,
      from: customFrom,
      to: customTo,
      page: String(page),
    };
    Object.entries(values).forEach(([key, value]) =>
      value && value !== "all" && value !== "1"
        ? params.set(key, value)
        : params.delete(key),
    );
    router.replace(`/invoices?${params.toString()}`, {
      scroll: false,
    });
  }, [
    chartCurrency,
    clientFilter,
    currencyFilter,
    customFrom,
    customTo,
    page,
    period,
    search,
    selectedYear,
    statusFilter,
    tab,
    router,
  ]);

  useEffect(() => {
    const choices = dimensions
      .filter((row) => row.invoice_year === selectedYear)
      .sort((a, b) => b.invoice_count - a.invoice_count);
    if (
      choices.length &&
      !choices.some((row) => row.currency === chartCurrency)
    )
      setChartCurrency(choices[0].currency);
  }, [chartCurrency, dimensions, selectedYear]);

  const years = useMemo(
    () =>
      Array.from(
        new Set([currentYear, ...dimensions.map((row) => row.invoice_year)]),
      ).sort((a, b) => b - a),
    [currentYear, dimensions],
  );
  const currencies = useMemo(
    () => Array.from(new Set(dimensions.map((row) => row.currency))).sort(),
    [dimensions],
  );
  const invoiceYearCount = kpis.reduce(
    (sum, row) => sum + row.invoices_in_year,
    0,
  );

  function resetFilters() {
    setClientFilter("");
    setPeriod("all");
    setStatusFilter("");
    setCurrencyFilter("");
    setSearch("");
    setCustomFrom("");
    setCustomTo("");
    setPage(1);
  }
  function showFilteredInvoices(nextStatus: string, year?: number) {
    setStatusFilter(nextStatus);
    setClientFilter("");
    setCurrencyFilter("");
    setSearch("");
    setPage(1);
    if (year) {
      setPeriod("custom");
      setCustomFrom(`${year}-01-01`);
      setCustomTo(`${year}-12-31`);
    } else {
      setPeriod("all");
      setCustomFrom("");
      setCustomTo("");
    }
    selectTab("all");
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] px-5 py-7 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="relative flex min-h-[200px] items-center overflow-hidden rounded-[2rem] bg-[#0F172A] p-8 text-white shadow-xl shadow-slate-300/50 lg:p-10">
          <div className="absolute -right-24 -top-28 h-80 w-80 rounded-full bg-[#153E90]/70 blur-3xl" />
          <div className="absolute bottom-0 right-1/3 h-36 w-36 rounded-full bg-blue-400/10 blur-2xl" />
          <div className="relative flex w-full flex-col gap-7 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-200">
                Billing &amp; Collections
              </p>
              <h1 className="mt-2 text-4xl font-bold tracking-tight lg:text-5xl">
                Invoices
              </h1>
              <p className="mt-3 text-sm text-slate-300">
                Manage billing, recurring schedules, payments, and collections.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setChooserOpen(true)}
              className="rounded-2xl bg-white px-6 py-3.5 text-sm font-bold text-[#0F172A] shadow-xl shadow-black/10 hover:bg-blue-50"
            >
              + New Invoice
            </button>
          </div>
        </header>
        <nav
          className="relative z-10 mx-3 -mt-5 flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2.5 shadow-lg shadow-slate-200/60 sm:mx-8"
          aria-label="Invoice sections"
        >
          {(["overview", "all", "recurring"] as InvoiceTab[]).map((item) => (
            <button
              key={item}
              onClick={() => selectTab(item)}
              className={`whitespace-nowrap rounded-xl px-5 py-2.5 text-sm font-bold transition ${tab === item ? "bg-[#0F172A] text-white shadow-sm" : "text-slate-500 hover:bg-slate-50"}`}
            >
              {item === "all"
                ? "All Invoices"
                : item === "recurring"
                  ? "Recurring Invoices"
                  : "Overview"}
            </button>
          ))}
        </nav>
        {error ? (
          <div
            role="alert"
            className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
          >
            {error}
          </div>
        ) : null}

        {tab === "overview" ? (
          <div className="mt-6 space-y-6 animate-[fadeIn_.2s_ease-out]">
            {overviewLoading ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-40 animate-pulse rounded-3xl border border-slate-200 bg-white"
                  />
                ))}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <button
                  type="button"
                  onClick={() => showFilteredInvoices("open")}
                  className="rounded-3xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg"
                >
                  <p className="text-xs font-bold uppercase tracking-[.16em] text-slate-400">
                    Total Open
                  </p>
                  <div className="mt-4 space-y-2">
                    {kpis
                      .filter((row) => row.open_amount > 0)
                      .map((row) => (
                        <p
                          key={row.currency}
                          className="text-2xl font-bold text-[#153E90]"
                        >
                          {money(row.currency, row.open_amount)}
                        </p>
                      ))}
                    {!kpis.some((row) => row.open_amount > 0) ? (
                      <p className="text-2xl font-bold">—</p>
                    ) : null}
                  </div>
                  <p className="mt-4 text-xs text-slate-400">
                    Sent and overdue invoices · View all →
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => showFilteredInvoices("paid")}
                  className="rounded-3xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-1 hover:border-emerald-200 hover:shadow-lg"
                >
                  <p className="text-xs font-bold uppercase tracking-[.16em] text-slate-400">
                    Total Paid
                  </p>
                  <div className="mt-4 space-y-2">
                    {kpis
                      .filter((row) => row.paid_amount > 0)
                      .map((row) => (
                        <p
                          key={row.currency}
                          className="text-2xl font-bold text-emerald-700"
                        >
                          {money(row.currency, row.paid_amount)}
                        </p>
                      ))}
                    {!kpis.some((row) => row.paid_amount > 0) ? (
                      <p className="text-2xl font-bold">—</p>
                    ) : null}
                  </div>
                  <p className="mt-4 text-xs text-slate-400">
                    Completed collections · View all →
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => showFilteredInvoices("", selectedYear)}
                  className="rounded-3xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg"
                >
                  <p className="text-xs font-bold uppercase tracking-[.16em] text-slate-400">
                    Invoices in {selectedYear}
                  </p>
                  <p className="mt-4 text-3xl font-bold text-slate-950">
                    {invoiceYearCount}
                  </p>
                  <p className="mt-4 text-xs text-slate-400">
                    Draft, sent, overdue, and paid · View →
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => showFilteredInvoices("overdue")}
                  className="rounded-3xl border border-red-100 bg-white p-6 text-left shadow-sm transition hover:-translate-y-1 hover:border-red-200 hover:shadow-lg"
                >
                  <p className="text-xs font-bold uppercase tracking-[.16em] text-red-400">
                    Overdue
                  </p>
                  <p className="mt-4 text-3xl font-bold text-red-700">
                    {actualOverdueCount}
                  </p>
                  <div className="mt-3 space-y-1">
                    {kpis
                      .filter((row) => row.overdue_amount > 0)
                      .map((row) => (
                        <p
                          key={row.currency}
                          className="text-sm font-bold text-red-600"
                        >
                          {money(row.currency, row.overdue_amount)}
                        </p>
                      ))}
                  </div>
                  <p className="mt-3 text-xs text-slate-400">
                    Past due today · View all →
                  </p>
                </button>
              </div>
            )}
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-950">
                    Invoices issued in {selectedYear}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Open and paid totals use the invoice issue month.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    disabled={!years.includes(selectedYear - 1)}
                    onClick={() => setSelectedYear((year) => year - 1)}
                    className="h-10 w-10 rounded-xl border border-slate-200 font-bold disabled:opacity-30"
                  >
                    ←
                  </button>
                  <select
                    value={selectedYear}
                    onChange={(event) =>
                      setSelectedYear(Number(event.target.value))
                    }
                    className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold"
                  >
                    {years.length ? (
                      years.map((year) => <option key={year}>{year}</option>)
                    ) : (
                      <option>{currentYear}</option>
                    )}
                  </select>
                  <button
                    disabled={
                      selectedYear >= currentYear ||
                      !years.includes(selectedYear + 1)
                    }
                    onClick={() => setSelectedYear((year) => year + 1)}
                    className="h-10 w-10 rounded-xl border border-slate-200 font-bold disabled:opacity-30"
                  >
                    →
                  </button>
                  <select
                    aria-label="Chart currency"
                    value={chartCurrency}
                    onChange={(event) => setChartCurrency(event.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold"
                  >
                    {currencies.map((currency) => (
                      <option key={currency}>{currency}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-7 overflow-x-auto">
                <div className="h-[340px] min-w-[680px]">
                  {chartLoading ? (
                    <div className="h-full animate-pulse rounded-2xl bg-slate-50" />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthly} barGap={6}>
                        <CartesianGrid vertical={false} stroke="#E5E7EB" />
                        <XAxis
                          dataKey="month"
                          tickFormatter={(value) => String(value).slice(0, 3)}
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#64748B", fontSize: 12 }}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#64748B", fontSize: 12 }}
                          tickFormatter={(value) =>
                            Intl.NumberFormat("en", {
                              notation: "compact",
                            }).format(Number(value))
                          }
                        />
                        <Tooltip
                          content={<ChartTooltip />}
                          cursor={{ fill: "#F8FAFC" }}
                        />
                        <Bar
                          dataKey="open_amount"
                          name="Open"
                          fill="#153E90"
                          radius={[6, 6, 0, 0]}
                          maxBarSize={26}
                        />
                        <Bar
                          dataKey="paid_amount"
                          name="Paid"
                          fill="#10B981"
                          radius={[6, 6, 0, 0]}
                          maxBarSize={26}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </section>
            <section>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">Open Invoices</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Up to 10 Draft, sent, or overdue invoices.
                  </p>
                </div>
                <button
                  onClick={() => showFilteredInvoices("open")}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-[#153E90]"
                >
                  View All Invoices
                </button>
              </div>
              {!overviewLoading && !recent.length ? (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-white py-16 text-center">
                  <p className="font-bold">No open invoices right now.</p>
                  <button
                    onClick={() => setChooserOpen(true)}
                    className="mt-3 text-sm font-bold text-[#153E90]"
                  >
                    Create Invoice
                  </button>
                </div>
              ) : (
                <InvoiceTable
                  invoices={recent}
                  loading={overviewLoading}
                  onOpen={(id) => router.push(`/invoices/${id}`)}
                />
              )}
            </section>
          </div>
        ) : null}

        {tab === "all" ? (
          <div className="mt-6 animate-[fadeIn_.2s_ease-out]">
            <div className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-5">
              <select
                aria-label="Client"
                value={clientFilter}
                onChange={(event) => setClientFilter(event.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              >
                <option value="">All Clients</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
              <select
                aria-label="Time period"
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              >
                <option value="all">All Time</option>
                <option value="this_month">This Month</option>
                <option value="last_month">Last Month</option>
                <option value="this_quarter">This Quarter</option>
                <option value="last_quarter">Last Quarter</option>
                <option value="this_year">This Year</option>
                <option value="last_year">Last Year</option>
                <option value="custom">Custom Date Range</option>
              </select>
              <select
                aria-label="Status"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              >
                <option value="">All Statuses</option>
                <option value="open">Open (Sent + Overdue)</option>
                {["draft", "sent", "overdue", "paid", "void", "cancelled"].map(
                  (value) => (
                    <option key={value} value={value}>
                      {value[0].toUpperCase() + value.slice(1)}
                    </option>
                  ),
                )}
              </select>
              <select
                aria-label="Currency"
                value={currencyFilter}
                onChange={(event) => setCurrencyFilter(event.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              >
                <option value="">All Currencies</option>
                {currencies.map((currency) => (
                  <option key={currency}>{currency}</option>
                ))}
              </select>
              <input
                data-shortcut-search
                aria-label="Search invoices"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Invoice # or client"
                className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              />
              {period === "custom" ? (
                <>
                  <input
                    aria-label="From date"
                    type="date"
                    value={customFrom}
                    onChange={(event) => setCustomFrom(event.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  />
                  <input
                    aria-label="To date"
                    type="date"
                    value={customTo}
                    onChange={(event) => setCustomTo(event.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  />
                </>
              ) : null}
              <button
                onClick={resetFilters}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600"
              >
                Reset Filters
              </button>
            </div>
            <div className="mt-5">
              {!tableLoading && !allInvoices.length ? (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-white py-16 text-center">
                  <p className="font-bold">No invoices match your filters.</p>
                  <button
                    onClick={resetFilters}
                    className="mt-3 text-sm font-bold text-[#153E90]"
                  >
                    Clear Filters
                  </button>
                </div>
              ) : (
                <InvoiceTable
                  invoices={allInvoices}
                  loading={tableLoading}
                  onOpen={(id) => router.push(`/invoices/${id}`)}
                />
              )}
            </div>
            {invoiceCount > 0 ? (
              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-500">
                  Showing {(page - 1) * PAGE_SIZE + 1}–
                  {Math.min(page * PAGE_SIZE, invoiceCount)} of {invoiceCount}{" "}
                  invoices
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage((value) => value - 1)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold disabled:opacity-40"
                  >
                    Previous
                  </button>
                  {Array.from(
                    { length: Math.ceil(invoiceCount / PAGE_SIZE) },
                    (_, index) => index + 1,
                  )
                    .filter(
                      (number) =>
                        number === 1 ||
                        number === Math.ceil(invoiceCount / PAGE_SIZE) ||
                        Math.abs(number - page) <= 1,
                    )
                    .map((number, index, values) => (
                      <span key={number} className="contents">
                        {index > 0 && number - values[index - 1] > 1 ? (
                          <span className="px-1 py-2 text-slate-400">…</span>
                        ) : null}
                        <button
                          onClick={() => setPage(number)}
                          className={`h-10 min-w-10 rounded-xl px-3 text-sm font-bold ${page === number ? "bg-[#0F172A] text-white" : "border border-slate-200 bg-white"}`}
                        >
                          {number}
                        </button>
                      </span>
                    ))}
                  <button
                    disabled={page >= Math.ceil(invoiceCount / PAGE_SIZE)}
                    onClick={() => setPage((value) => value + 1)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {tab === "recurring" ? (
          <div className="mt-6 animate-[fadeIn_.2s_ease-out]">
            <RecurringInvoicesWorkspace embedded />
          </div>
        ) : null}
      </div>

      {chooserOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-invoice-title"
        >
          <button
            type="button"
            aria-label="Close create invoice"
            onClick={() => setChooserOpen(false)}
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
          />
          <div className="relative w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between">
              <div>
                <h2 id="create-invoice-title" className="text-2xl font-bold">
                  Create Invoice
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Choose the invoice workflow you want to start.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setChooserOpen(false)}
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-xl text-xl text-slate-400 hover:bg-slate-100"
              >
                ×
              </button>
            </div>
            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              <button
                onClick={() => router.push("/invoices/new")}
                className="group rounded-2xl border border-slate-200 p-5 text-left hover:border-blue-300 hover:bg-blue-50/30"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-[#153E90]">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="h-5 w-5"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>
                <h3 className="mt-5 text-lg font-bold">One-Time Invoice</h3>
                <p className="mt-2 min-h-10 text-sm text-slate-500">
                  Create a single invoice for a client.
                </p>
                <span className="mt-5 inline-flex text-sm font-bold text-[#153E90]">
                  Create One-Time Invoice →
                </span>
              </button>
              <button
                onClick={() => router.push("/invoices/recurring/new")}
                className="group rounded-2xl border border-slate-200 p-5 text-left hover:border-violet-300 hover:bg-violet-50/30"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="h-5 w-5"
                  >
                    <path d="M20 7h-7V0M4 17h7v7M21 12a9 9 0 0 0-15.5-6.2L1 10M3 12a9 9 0 0 0 15.5 6.2L23 14" />
                  </svg>
                </span>
                <h3 className="mt-5 text-lg font-bold">Recurring Invoice</h3>
                <p className="mt-2 min-h-10 text-sm text-slate-500">
                  Create an invoice schedule that generates future invoices
                  automatically.
                </p>
                <span className="mt-5 inline-flex text-sm font-bold text-violet-700">
                  Create Recurring Invoice →
                </span>
              </button>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setChooserOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

export default function InvoicesPage() {
  return (
    <Suspense fallback={null}>
      <InvoicesPageContent />
    </Suspense>
  );
}

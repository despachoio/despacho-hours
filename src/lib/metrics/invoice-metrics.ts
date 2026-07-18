import { supabase } from "@/lib/supabase";
import { businessDateKey } from "./date-ranges";
import type {
  CurrencyInvoiceSummary,
  InvoiceListRow,
  InvoiceMetricFilters,
  InvoiceMetricRow,
  InvoiceMetrics,
  OverdueInvoiceListFilters,
} from "./types";

const PAGE_SIZE = 1000;
const OVERDUE_EXCLUDED_STATUSES = new Set([
  "draft",
  "paid",
  "written_off",
  "write_off",
  "written-off",
  "written off",
  "write-off",
  "cancelled",
  "canceled",
  "void",
  "voided",
]);

export function formatInvoiceMoney(currency: string, value: number) {
  return `${currency} ${Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function normalizedStatus(status: string | null) {
  return String(status || "").trim().toLowerCase();
}

export function invoiceRemainingBalance(invoice: InvoiceMetricRow) {
  return Math.max(
    Number(invoice.total_amount || 0) - Number(invoice.paid_amount || 0),
    0,
  );
}

export function isInvoiceOverdue(
  invoice: InvoiceMetricRow,
  today = businessDateKey(),
) {
  return Boolean(
    invoice.due_date &&
      invoice.due_date < today &&
      invoiceRemainingBalance(invoice) > 0 &&
      !OVERDUE_EXCLUDED_STATUSES.has(normalizedStatus(invoice.status)),
  );
}

function currencySummary(
  summaries: Map<string, CurrencyInvoiceSummary>,
  currency: string | null,
) {
  const key = currency || "USD";
  const existing = summaries.get(key);
  if (existing) return existing;
  const created: CurrencyInvoiceSummary = {
    currency: key,
    openAmount: 0,
    paidAmount: 0,
    paidInYearAmount: 0,
    overdueCount: 0,
    overdueAmount: 0,
    invoicesInYear: 0,
  };
  summaries.set(key, created);
  return created;
}

export function calculateInvoiceMetrics(
  invoiceRows: InvoiceMetricRow[],
  selectedYear: number,
  today = businessDateKey(),
): InvoiceMetrics {
  const invoices = Array.from(
    new Map(invoiceRows.map((invoice) => [invoice.id, invoice])).values(),
  );
  const summaries = new Map<string, CurrencyInvoiceSummary>();

  for (const invoice of invoices) {
    const summary = currencySummary(summaries, invoice.currency);
    const status = normalizedStatus(invoice.status);
    const total = Number(invoice.total_amount || 0);
    const paid = Number(invoice.paid_amount || 0);

    if (["sent", "overdue"].includes(status)) summary.openAmount += total;
    if (status === "paid") summary.paidAmount += paid || total;
    if (
      status === "paid" &&
      invoice.paid_at?.slice(0, 4) === String(selectedYear)
    ) {
      summary.paidInYearAmount += paid || total;
    }
    if (
      invoice.issue_date?.slice(0, 4) === String(selectedYear) &&
      !["void", "voided", "cancelled", "canceled"].includes(status)
    ) {
      summary.invoicesInYear += 1;
    }
    if (isInvoiceOverdue(invoice, today)) {
      summary.overdueCount += 1;
      summary.overdueAmount += invoiceRemainingBalance(invoice);
    }
  }

  const currencies = Array.from(summaries.values()).sort((a, b) =>
    a.currency.localeCompare(b.currency),
  );
  return {
    selectedYear,
    invoiceCount: currencies.reduce(
      (sum, row) => sum + row.invoicesInYear,
      0,
    ),
    overdueCount: currencies.reduce(
      (sum, row) => sum + row.overdueCount,
      0,
    ),
    currencies,
  };
}

async function fetchAllInvoiceRows<T extends InvoiceMetricRow>(
  select: string,
) {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const query = supabase.from("invoices").select(select);
    const result = await query
      .order("invoice_number", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (result.error) throw result.error;
    const page = (result.data || []) as unknown as T[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

export async function fetchOverdueInvoices(
  filters: OverdueInvoiceListFilters,
  today = businessDateKey(),
) {
  const rows: InvoiceListRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase
      .from("invoices")
      .select(
        "id,invoice_number,client_id,issue_date,due_date,currency,total_amount,paid_amount,status,generated_from_recurring,clients(name)",
      )
      .lt("due_date", today);
    if (filters.clientId) query = query.eq("client_id", filters.clientId);
    if (filters.currency) query = query.eq("currency", filters.currency);
    if (filters.issueDateFrom)
      query = query.gte("issue_date", filters.issueDateFrom);
    if (filters.issueDateTo)
      query = query.lte("issue_date", filters.issueDateTo);
    if (filters.invoiceNumber !== undefined)
      query = query.eq("invoice_number", filters.invoiceNumber);
    if (filters.clientIds) query = query.in("client_id", filters.clientIds);
    const result = await query
      .order("invoice_number", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (result.error) throw result.error;
    const page = (result.data || []) as unknown as InvoiceListRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows.filter((invoice) => isInvoiceOverdue(invoice, today));
}

export async function getInvoiceMetrics(
  filters: InvoiceMetricFilters,
): Promise<InvoiceMetrics> {
  const invoices = await fetchAllInvoiceRows<InvoiceMetricRow>(
    "id,currency,total_amount,paid_amount,paid_at,status,issue_date,due_date,invoice_number",
  );
  return calculateInvoiceMetrics(invoices, filters.year);
}

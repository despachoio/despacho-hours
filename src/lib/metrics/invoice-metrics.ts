import { supabase } from "@/lib/supabase";
import type { InvoiceMetricFilters, InvoiceMetrics } from "./types";

type RpcRow = Record<string, unknown>;

export function formatInvoiceMoney(currency: string, value: number) {
  return `${currency} ${Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export async function getInvoiceMetrics(
  filters: InvoiceMetricFilters,
): Promise<InvoiceMetrics> {
  const result = await supabase.rpc("get_invoice_kpi_summary", {
    p_year: filters.year,
  });
  if (result.error) throw result.error;

  const currencies = ((result.data || []) as RpcRow[]).map((row) => ({
    currency: String(row.currency || "USD"),
    openAmount: Number(row.open_amount || 0),
    paidAmount: Number(row.paid_amount || 0),
    overdueCount: Number(row.overdue_count || 0),
    overdueAmount: Number(row.overdue_amount || 0),
    invoicesInYear: Number(row.invoices_in_year || 0),
  }));
  return {
    selectedYear: filters.year,
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

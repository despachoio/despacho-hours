import { businessDateKey } from "@/lib/metrics/date-ranges";

export type WalletActivityFilter =
  | "all"
  | "credits"
  | "usage"
  | "adjustments"
  | "invoices";

export type WalletActivityFilters = {
  type: WalletActivityFilter;
  employee: string;
  fromDate: string;
  toDate: string;
  search: string;
};

export type WalletActivityTransaction = {
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
  balance_after?: number;
  invoices: { invoice_number: string } | null;
  time_entries: {
    entry_date: string | null;
    started_at: string | null;
    stopped_at: string | null;
    description: string | null;
    employee_id: string | null;
    employees: { id: string; name: string } | null;
  } | null;
};

export type WalletActivityTransactionWithBalance =
  WalletActivityTransaction & { balance_after: number };

export const emptyWalletActivityFilters: WalletActivityFilters = {
  type: "all",
  employee: "all",
  fromDate: "",
  toDate: "",
  search: "",
};

export function walletActivityDateKey(
  transaction: WalletActivityTransaction,
) {
  if (transaction.time_entries?.entry_date) {
    return transaction.time_entries.entry_date;
  }
  return businessDateKey(new Date(transaction.created_at));
}

export function withWalletBalances(
  transactions: WalletActivityTransaction[],
  currentBalance: number,
) {
  return transactions.reduce<{
    balance: number;
    rows: WalletActivityTransactionWithBalance[];
  }>(
    (result, transaction) => ({
      balance: result.balance - Number(transaction.hours_delta || 0),
      rows: [
        ...result.rows,
        { ...transaction, balance_after: result.balance },
      ],
    }),
    { balance: Number(currentBalance || 0), rows: [] },
  ).rows;
}

export function filterWalletActivity(
  transactions: WalletActivityTransactionWithBalance[],
  filters: WalletActivityFilters,
) {
  let rows = transactions;

  if (filters.type === "credits") {
    rows = rows.filter((item) => Number(item.hours_delta || 0) > 0);
  } else if (filters.type === "usage") {
    rows = rows.filter((item) => item.transaction_type === "time_debit");
  } else if (filters.type === "invoices") {
    rows = rows.filter((item) => item.transaction_type === "invoice_credit");
  } else if (filters.type === "adjustments") {
    rows = rows.filter((item) =>
      ["manual_credit", "manual_debit", "adjustment", "refund"].includes(
        item.transaction_type,
      ),
    );
  }

  if (filters.employee !== "all") {
    rows = rows.filter(
      (item) => item.time_entries?.employee_id === filters.employee,
    );
  }
  if (filters.fromDate) {
    rows = rows.filter(
      (item) => walletActivityDateKey(item) >= filters.fromDate,
    );
  }
  if (filters.toDate) {
    rows = rows.filter(
      (item) => walletActivityDateKey(item) <= filters.toDate,
    );
  }

  const search = filters.search.trim().toLowerCase();
  if (search) {
    rows = rows.filter((item) =>
      [
        item.transaction_type.replaceAll("_", " "),
        item.notes || "",
        item.invoices?.invoice_number || "",
        item.time_entries?.description || "",
        item.time_entries?.employees?.name || "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(search),
    );
  }

  return rows;
}

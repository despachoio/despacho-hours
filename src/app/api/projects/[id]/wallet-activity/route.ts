import { getProfileApiContext } from "@/lib/server/profile-auth";
import { normalizeRole } from "@/lib/roles";
import {
  filterWalletActivity,
  withWalletBalances,
  type WalletActivityFilter,
  type WalletActivityFilters,
  type WalletActivityTransaction,
} from "@/lib/project-wallet-activity";

const allowedRoles = new Set([
  "finance admin",
  "super admin",
  "admin",
  "manager",
]);

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const actor = await getProfileApiContext(request);
  if ("error" in actor) {
    return Response.json({ error: actor.error }, { status: actor.status });
  }
  if (!allowedRoles.has(normalizeRole(actor.profile.role))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: projectId } = await context.params;
  const url = new URL(request.url);
  const requestedType = url.searchParams.get("type") || "all";
  const validTypes = new Set<WalletActivityFilter>([
    "all",
    "credits",
    "usage",
    "adjustments",
    "invoices",
  ]);
  const filters: WalletActivityFilters = {
    type: validTypes.has(requestedType as WalletActivityFilter)
      ? (requestedType as WalletActivityFilter)
      : "all",
    employee: url.searchParams.get("employee") || "all",
    fromDate: url.searchParams.get("fromDate") || "",
    toDate: url.searchParams.get("toDate") || "",
    search: url.searchParams.get("search") || "",
  };

  const [walletResult, ledgerResult] = await Promise.all([
    actor.userClient
      .from("project_hour_wallets")
      .select("remaining_hours")
      .eq("project_id", projectId)
      .maybeSingle(),
    actor.userClient
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
        invoices(invoice_number),
        time_entries(
          entry_date,
          started_at,
          stopped_at,
          description,
          employee_id,
          employees(id,name)
        )
      `)
      .eq("project_id", projectId)
      .order("created_at", { ascending: false }),
  ]);

  if (walletResult.error) {
    return Response.json({ error: walletResult.error.message }, { status: 500 });
  }
  if (ledgerResult.error) {
    return Response.json({ error: ledgerResult.error.message }, { status: 500 });
  }

  const ledger = (ledgerResult.data || []) as unknown as WalletActivityTransaction[];
  const normalized = ledger.map((item) => ({
    ...item,
    hours_delta: Number(item.hours_delta || 0),
  }));
  const withBalances = withWalletBalances(
    normalized,
    Number(walletResult.data?.remaining_hours || 0),
  );

  return Response.json({
    rows: filterWalletActivity(withBalances, filters),
  });
}

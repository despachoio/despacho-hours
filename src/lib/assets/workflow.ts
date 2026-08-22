import { isAdminLevelRole } from "@/lib/roles";

export const ASSET_REQUEST_STATUSES = ["pending_approval","approved","rejected","awaiting_issue","issued","cancelled","under_repair","completed"] as const;
export type AssetRequestStatus = (typeof ASSET_REQUEST_STATUSES)[number];

export function canAdministerAssets(role: unknown) { return isAdminLevelRole(role); }
export function canEmployeeCancelAssetRequest(status: string) { return status === "pending_approval"; }
export function isLowStock(item: { stock_tracked?: boolean; current_stock?: number; minimum_stock_level?: number }) {
  return Boolean(item.stock_tracked) && Number(item.current_stock || 0) <= Number(item.minimum_stock_level || 0);
}
export function nonNegativeQuantity(value: unknown, fallback = 1) {
  const quantity = Math.floor(Number(value));
  return Number.isFinite(quantity) && quantity > 0 ? quantity : fallback;
}
export function itemsForCategory<T extends { category_id: string; active?: boolean }>(items: T[], categoryId: string) {
  return items.filter((item) => item.category_id === categoryId && item.active !== false);
}
export function requestNeedsExistingAsset(code: string) { return ["replacement","repair","lost_damaged_replacement"].includes(code); }
export function requestCode(sequence: number) { return `AR-${String(sequence).padStart(6,"0")}`; }

export function supportsPhysicalAssets(item: { item_type?: string; individually_tracked?: boolean }) {
  return item.item_type === "durable_asset" || item.individually_tracked === true;
}

export function isAssetAvailable(
  asset: { active?: boolean; status?: string; item?: { active?: boolean } | null },
  activeAssignmentAssetIds: ReadonlySet<string> = new Set(),
  assetId = "",
) {
  return asset.active !== false
    && asset.item?.active !== false
    && ["available", "returned"].includes(asset.status || "")
    && !activeAssignmentAssetIds.has(assetId);
}

export function assetOptionLabel(asset: {
  asset_tag?: string | null;
  serial_number?: string | null;
  brand?: string | null;
  model?: string | null;
  item?: { name?: string | null } | null;
}) {
  const identity = [asset.brand, asset.model].filter(Boolean).join(" ") || "Unspecified brand/model";
  return [asset.item?.name || "Asset", identity, asset.asset_tag || "No tag", asset.serial_number || "No serial"].join(" — ");
}

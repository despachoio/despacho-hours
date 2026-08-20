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


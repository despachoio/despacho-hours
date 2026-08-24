export type KairoRole =
  | "Finance Admin"
  | "Super Admin"
  | "Admin"
  | "Manager"
  | "Employee";

export function normalizeRole(role: unknown) {
  return String(role || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

export function isFinanceAdminRole(role: unknown) {
  return normalizeRole(role) === "finance admin";
}

export function isSuperAdminRole(role: unknown) {
  return normalizeRole(role) === "super admin";
}

export function hasSuperAdminAccess(role: unknown) {
  return isFinanceAdminRole(role) || isSuperAdminRole(role);
}

export function isAdminRole(role: unknown) {
  return normalizeRole(role) === "admin";
}

export function isAdminLevelRole(role: unknown) {
  return (
    isFinanceAdminRole(role) || isSuperAdminRole(role) || isAdminRole(role)
  );
}

export function canAccessInvoices(role: unknown) {
  return hasSuperAdminAccess(role);
}

/** Commercial Work Orders are intentionally restricted to the two highest roles. */
export function canAccessWorkOrders(role: unknown) {
  return hasSuperAdminAccess(role);
}

export function canonicalRole(role: unknown): KairoRole | null {
  const normalized = normalizeRole(role);
  if (normalized === "finance admin") return "Finance Admin";
  if (normalized === "super admin") return "Super Admin";
  if (normalized === "admin") return "Admin";
  if (normalized === "manager") return "Manager";
  if (normalized === "employee") return "Employee";
  return null;
}

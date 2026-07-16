export type KairoRole = "Super Admin" | "Admin" | "Manager" | "Employee";

export function normalizeRole(role: unknown) {
  return String(role || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

export function isSuperAdminRole(role: unknown) {
  return normalizeRole(role) === "super admin";
}

export function isAdminRole(role: unknown) {
  return normalizeRole(role) === "admin";
}

export function isAdminLevelRole(role: unknown) {
  return isSuperAdminRole(role) || isAdminRole(role);
}

export function canAccessInvoices(role: unknown) {
  return isSuperAdminRole(role);
}

export function canonicalRole(role: unknown): KairoRole | null {
  const normalized = normalizeRole(role);
  if (normalized === "super admin") return "Super Admin";
  if (normalized === "admin") return "Admin";
  if (normalized === "manager") return "Manager";
  if (normalized === "employee") return "Employee";
  return null;
}

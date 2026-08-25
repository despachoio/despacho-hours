import type { GuideRole } from "@/lib/user-guide/types";

export const GUIDE_ROLES: GuideRole[] = [
  "Employee",
  "Manager",
  "Admin",
  "Finance Admin",
  "Super Admin",
];

export const ALL_GUIDE_ROLES = [...GUIDE_ROLES];
export const LEADERSHIP_ROLES: GuideRole[] = [
  "Manager",
  "Admin",
  "Finance Admin",
  "Super Admin",
];
export const ADMIN_LEVEL_ROLES: GuideRole[] = [
  "Admin",
  "Finance Admin",
  "Super Admin",
];
export const TOP_LEVEL_ROLES: GuideRole[] = ["Finance Admin", "Super Admin"];

export function rolesVisibleTo(viewer: GuideRole): GuideRole[] {
  if (viewer === "Finance Admin" || viewer === "Super Admin") return GUIDE_ROLES;
  if (viewer === "Admin") return ["Employee", "Manager", "Admin"];
  if (viewer === "Manager") return ["Employee", "Manager"];
  return ["Employee"];
}

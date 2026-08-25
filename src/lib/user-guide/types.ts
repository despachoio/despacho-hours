import type { KairoRole } from "@/lib/roles";

export type GuideRole = KairoRole;
export type GuideAccess = "full" | "limited" | "none";
export type GuideIcon =
  | "overview"
  | "start"
  | "dashboard"
  | "time"
  | "workforce"
  | "time-off"
  | "payroll"
  | "invoices"
  | "accounts"
  | "settings"
  | "roles"
  | "faq";

export type GuideStep = {
  title: string;
  steps: string[];
  roles: GuideRole[];
  keywords?: string[];
};

export type GuideBlock = {
  title: string;
  description: string;
  bullets: string[];
  roles: GuideRole[];
};

export type GuideSection = {
  id: string;
  title: string;
  icon: GuideIcon;
  description: string;
  keywords: string[];
  roles: GuideRole[];
  blocks: GuideBlock[];
  workflows?: GuideStep[];
};

export type PermissionCell = {
  access: GuideAccess;
  note: string;
};

export type PermissionRow = {
  feature: string;
  module: string;
  permissions: Record<GuideRole, PermissionCell>;
};

export type RoleCapability = {
  role: GuideRole;
  summary: string;
  modules: Array<{
    module: string;
    capabilities: string[];
  }>;
};

export type UserGuidePayload = {
  profile: { name: string; role: GuideRole };
  allowedRoles: GuideRole[];
  roleCapabilities: RoleCapability[];
  sections: GuideSection[];
  permissionMatrix: PermissionRow[];
};

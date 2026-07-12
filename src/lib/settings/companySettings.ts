import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFile } from "fs/promises";
import path from "path";
import {
  DEFAULT_COMPANY_SETTINGS,
  type CompanySettings,
} from "@/lib/settings/companySettingsDefaults";

export type { CompanySettings } from "@/lib/settings/companySettingsDefaults";
export { DEFAULT_COMPANY_SETTINGS } from "@/lib/settings/companySettingsDefaults";

function normalize(row: Partial<CompanySettings> | null): CompanySettings {
  if (!row) return { ...DEFAULT_COMPANY_SETTINGS };
  return {
    ...DEFAULT_COMPANY_SETTINGS,
    ...row,
    id: row.id || null,
    default_payment_terms_days: Number(row.default_payment_terms_days ?? 7),
    invoice_number_start: Number(row.invoice_number_start ?? 1001),
    default_tax_rate: Number(row.default_tax_rate ?? 0),
    default_reminder_before_due_days:
      row.default_reminder_before_due_days || [],
    default_reminder_after_due_days: row.default_reminder_after_due_days || [],
  };
}

export function createSettingsAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error("Company settings service is not configured");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function loadCompanySettings(client?: SupabaseClient) {
  const admin = client || createSettingsAdminClient();
  const { data, error } = await admin
    .from("company_settings")
    .select("*")
    .eq("singleton_key", true)
    .maybeSingle();
  if (error) {
    console.error("Company settings load failed:", {
      message: error.message,
      code: error.code,
    });
    return { ...DEFAULT_COMPANY_SETTINGS };
  }
  return normalize(data as Partial<CompanySettings> | null);
}

export function renderSettingsTemplate(
  template: string,
  values: Record<string, string>,
) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{{${key}}}`, value),
    template,
  );
}

export async function loadCompanyLogo(
  settings: CompanySettings,
  invoiceLogo = true,
) {
  const configured =
    (invoiceLogo ? settings.invoice_logo_url : settings.logo_url) ||
    "/despacho-logo-full.png";
  let buffer: Buffer;
  if (/^https:\/\//i.test(configured)) {
    const response = await fetch(configured, { cache: "no-store" });
    if (!response.ok)
      throw new Error("Configured company logo could not be loaded");
    buffer = Buffer.from(await response.arrayBuffer());
  } else {
    const publicRoot = path.resolve(process.cwd(), "public");
    const assetPath = path.resolve(publicRoot, configured.replace(/^\/+/, ""));
    if (!assetPath.startsWith(`${publicRoot}${path.sep}`))
      throw new Error("Configured company logo path is invalid");
    buffer = await readFile(assetPath);
  }
  return {
    buffer,
    dataUrl: `data:image/png;base64,${buffer.toString("base64")}`,
  };
}

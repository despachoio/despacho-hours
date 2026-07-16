"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Tab =
  | "company"
  | "branding"
  | "invoices"
  | "payments"
  | "reminders"
  | "recurring"
  | "regional";

type Settings = Record<string, string | number | boolean | number[] | null>;

const tabs: { id: Tab; label: string; description: string }[] = [
  {
    id: "company",
    label: "Company",
    description: "Identity and contact details",
  },
  {
    id: "branding",
    label: "Branding",
    description: "Workspace and invoice logos",
  },
  {
    id: "invoices",
    label: "Invoices",
    description: "Billing and numbering defaults",
  },
  {
    id: "payments",
    label: "Payments",
    description: "Bank and remittance information",
  },
  {
    id: "reminders",
    label: "Reminders",
    description: "Default cadence and templates",
  },
  { id: "recurring", label: "Recurring", description: "New schedule defaults" },
  {
    id: "regional",
    label: "Regional",
    description: "Timezone and display formats",
  },
];

export default function CompanySettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("company");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }
      const response = await fetch("/api/settings/company", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json().catch(() => null);
      if (response.status === 401 || response.status === 403) {
        setAccessDenied(true);
      } else if (!response.ok) {
        setMessage({
          tone: "error",
          text: result?.error || "Company settings could not be loaded.",
        });
      } else {
        setSettings(result.settings as Settings);
      }
      setLoading(false);
    }
    void load();
  }, []);

  function update(field: string, value: Settings[string]) {
    setSettings((current) =>
      current ? { ...current, [field]: value } : current,
    );
    setMessage(null);
  }

  async function save() {
    if (!settings || saving) return;
    setSaving(true);
    setMessage(null);
    const { data } = await supabase.auth.getSession();
    const response = await fetch("/api/settings/company", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${data.session?.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(settings),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      setMessage({
        tone: "error",
        text: result?.error || "Settings could not be saved.",
      });
    } else {
      setSettings(result.settings as Settings);
      setMessage({ tone: "success", text: "Settings saved successfully." });
    }
    setSaving(false);
  }

  if (loading)
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F8FAFC] text-sm font-semibold text-slate-500">
        Loading company settings...
      </main>
    );

  if (accessDenied)
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F8FAFC] p-6">
        <div className="max-w-md rounded-3xl border border-red-100 bg-white p-9 text-center shadow-xl">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-xl text-red-600">
            ×
          </div>
          <h1 className="mt-5 text-2xl font-bold text-slate-950">
            Access Denied
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Only Administrators can view or edit Company Settings.
          </p>
        </div>
      </main>
    );

  if (!settings)
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F8FAFC] p-6 text-sm font-semibold text-red-600">
        Company settings could not be loaded.
      </main>
    );

  return (
    <main className="min-h-screen bg-[#F8FAFC] px-5 py-7 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="relative overflow-hidden rounded-[2rem] bg-[#0F172A] px-8 py-10 text-white shadow-xl shadow-slate-300/50 lg:px-11">
          <div className="absolute -right-20 -top-28 h-72 w-72 rounded-full bg-[#153E90]/70 blur-3xl" />
          <div className="relative">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-200">
              Workspace administration
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight lg:text-5xl">
              Company Settings
            </h1>
            <p className="mt-3 text-sm text-slate-300">
              Manage company information, billing defaults, and workspace
              preferences.
            </p>
          </div>
        </header>

        <div className="mt-7 grid gap-6 lg:grid-cols-[260px_1fr]">
          <nav
            className="h-fit rounded-3xl border border-slate-200 bg-white p-3 shadow-sm"
            aria-label="Settings sections"
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  setMessage(null);
                }}
                className={`mb-1 w-full rounded-2xl px-4 py-3 text-left transition last:mb-0 ${activeTab === tab.id ? "bg-[#0F172A] text-white shadow-md" : "text-slate-600 hover:bg-slate-50"}`}
              >
                <span className="block text-sm font-bold">{tab.label}</span>
                <span
                  className={`mt-0.5 block text-[11px] ${activeTab === tab.id ? "text-slate-300" : "text-slate-400"}`}
                >
                  {tab.description}
                </span>
              </button>
            ))}
          </nav>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="border-b border-slate-100 pb-5">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#153E90]">
                {tabs.find((tab) => tab.id === activeTab)?.label}
              </p>
              <h2 className="mt-2 text-2xl font-bold text-slate-950">
                {tabs.find((tab) => tab.id === activeTab)?.description}
              </h2>
            </div>
            <div className="mt-7">
              {activeTab === "company" ? (
                <CompanySection settings={settings} update={update} />
              ) : null}
              {activeTab === "branding" ? (
                <BrandingSection settings={settings} update={update} />
              ) : null}
              {activeTab === "invoices" ? (
                <InvoiceSection settings={settings} update={update} />
              ) : null}
              {activeTab === "payments" ? (
                <PaymentSection settings={settings} update={update} />
              ) : null}
              {activeTab === "reminders" ? (
                <ReminderSection settings={settings} update={update} />
              ) : null}
              {activeTab === "recurring" ? (
                <RecurringSection settings={settings} update={update} />
              ) : null}
              {activeTab === "regional" ? (
                <RegionalSection settings={settings} update={update} />
              ) : null}
            </div>
            {message ? (
              <div
                role="status"
                className={`mt-7 rounded-2xl border px-4 py-3 text-sm font-semibold ${message.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}
              >
                {message.text}
              </div>
            ) : null}
            <div className="mt-7 flex justify-end border-t border-slate-100 pt-6">
              <button
                type="button"
                data-shortcut-save
                data-shortcut-primary
                aria-keyshortcuts="Control+S Meta+S Control+Enter Meta+Enter"
                onClick={() => void save()}
                disabled={saving}
                className="rounded-2xl bg-[#153E90] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-900/15 transition hover:bg-blue-800 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

type SectionProps = {
  settings: Settings;
  update: (field: string, value: Settings[string]) => void;
};
const value = (settings: Settings, field: string) =>
  String(settings[field] ?? "");

function Field({
  label,
  field,
  settings,
  update,
  type = "text",
  min,
  placeholder,
}: SectionProps & {
  label: string;
  field: string;
  type?: string;
  min?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-600">
        {label}
      </span>
      <input
        type={type}
        min={min}
        value={value(settings, field)}
        placeholder={placeholder}
        onChange={(event) =>
          update(
            field,
            type === "number" ? Number(event.target.value) : event.target.value,
          )
        }
        className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
      />
    </label>
  );
}
function Textarea({
  label,
  field,
  settings,
  update,
  placeholder,
}: SectionProps & { label: string; field: string; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-600">
        {label}
      </span>
      <textarea
        value={value(settings, field)}
        placeholder={placeholder}
        onChange={(event) => update(field, event.target.value)}
        className="min-h-32 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm leading-6 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
      />
    </label>
  );
}
function Select({
  label,
  field,
  options,
  settings,
  update,
}: SectionProps & { label: string; field: string; options: string[] }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-600">
        {label}
      </span>
      <select
        value={value(settings, field)}
        onChange={(event) => update(field, event.target.value)}
        className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
const Grid = ({ children }: { children: React.ReactNode }) => (
  <div className="grid gap-5 md:grid-cols-2">{children}</div>
);

function CompanySection(props: SectionProps) {
  return (
    <Grid>
      <Field {...props} label="Company Name" field="company_name" />
      <Field {...props} label="Legal Name" field="legal_name" />
      <Field {...props} label="Address Line 1" field="address_line_1" />
      <Field {...props} label="Address Line 2" field="address_line_2" />
      <Field {...props} label="City" field="city" />
      <Field {...props} label="State / Province" field="state_province" />
      <Field {...props} label="Postal Code" field="postal_code" />
      <Field {...props} label="Country" field="country" />
      <Field
        {...props}
        label="Business Email"
        field="business_email"
        type="email"
      />
      <Field {...props} label="Website" field="website" type="url" />
      <Field {...props} label="Phone" field="phone" />
    </Grid>
  );
}
function BrandingSection(props: SectionProps) {
  return (
    <div className="space-y-6">
      <Grid>
        <Field
          {...props}
          label="Main Logo URL"
          field="logo_url"
          placeholder="/kairo-logo-full.png"
        />
        <Field
          {...props}
          label="Invoice Logo URL"
          field="invoice_logo_url"
          placeholder="/despacho-logo-full.png"
        />
      </Grid>
      <div className="grid gap-5 md:grid-cols-2">
        {["logo_url", "invoice_logo_url"].map((field) => (
          <div
            key={field}
            className="flex min-h-36 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5"
          >
            {value(props.settings, field) ? (
              <img
                src={value(props.settings, field)}
                alt={
                  field === "logo_url"
                    ? "Main logo preview"
                    : "Invoice logo preview"
                }
                className="max-h-20 max-w-full object-contain"
              />
            ) : (
              <span className="text-sm text-slate-400">
                No logo path configured
              </span>
            )}
          </div>
        ))}
      </div>
      <p className="text-xs leading-5 text-slate-400">
        Use an existing public path or an absolute HTTPS image URL. Image
        uploads and binary storage are not enabled.
      </p>
    </div>
  );
}
function InvoiceSection(props: SectionProps) {
  return (
    <div className="space-y-5">
      <Grid>
        <Select
          {...props}
          label="Default Currency"
          field="default_currency"
          options={["USD", "CAD", "INR"]}
        />
        <Field
          {...props}
          label="Default Payment Terms"
          field="default_payment_terms_days"
          type="number"
          min="0"
        />
        <Field
          {...props}
          label="Invoice Number Prefix"
          field="invoice_number_prefix"
        />
        <Field
          {...props}
          label="Invoice Number Start"
          field="invoice_number_start"
          type="number"
          min="1"
        />
        <Field
          {...props}
          label="Default Tax Rate (%)"
          field="default_tax_rate"
          type="number"
          min="0"
        />
        <Field {...props} label="Tax Label" field="tax_label" />
        <Field
          {...props}
          label="Tax Registration Number"
          field="tax_registration_number"
        />
      </Grid>
      <Textarea
        {...props}
        label="Default Invoice Notes"
        field="default_invoice_notes"
      />
    </div>
  );
}
function PaymentSection(props: SectionProps) {
  return (
    <div className="space-y-5">
      <Grid>
        <Field {...props} label="Bank Name" field="bank_name" />
        <Field {...props} label="Bank Address" field="bank_address" />
        <Field
          {...props}
          label="Institution Number"
          field="institution_number"
        />
        <Field {...props} label="Routing / ABA Number" field="routing_number" />
        <Field {...props} label="SWIFT BIC" field="swift_bic" />
        <Field {...props} label="Transit Number" field="transit_number" />
        <Field {...props} label="Account Number" field="account_number" />
        <Field {...props} label="Account Name" field="account_name" />
      </Grid>
      <Textarea
        {...props}
        label="Payment Instructions"
        field="payment_instructions"
      />
    </div>
  );
}
function ReminderSection(props: SectionProps) {
  const days = (field: string) =>
    Array.isArray(props.settings[field])
      ? (props.settings[field] as number[]).join(", ")
      : "";
  return (
    <div className="space-y-5">
      <Grid>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-600">
            Before Due reminders
          </span>
          <input
            defaultValue={days("default_reminder_before_due_days")}
            onBlur={(event) =>
              props.update(
                "default_reminder_before_due_days",
                event.target.value
                  .split(",")
                  .map((entry) => entry.trim())
                  .filter(Boolean)
                  .map(Number)
                  .filter((day) => Number.isInteger(day) && day >= 0),
              )
            }
            placeholder="7, 3, 1"
            className="min-h-12 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-600">
            After Due reminders
          </span>
          <input
            defaultValue={days("default_reminder_after_due_days")}
            onBlur={(event) =>
              props.update(
                "default_reminder_after_due_days",
                event.target.value
                  .split(",")
                  .map((entry) => entry.trim())
                  .filter(Boolean)
                  .map(Number)
                  .filter((day) => Number.isInteger(day) && day >= 0),
              )
            }
            placeholder="1, 7, 14, 30"
            className="min-h-12 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
          />
        </label>
      </Grid>
      <Field
        {...props}
        label="Default Reminder Subject"
        field="default_reminder_subject"
      />
      <Textarea
        {...props}
        label="Default Friendly Reminder Message"
        field="default_friendly_reminder_message"
      />
      <Textarea
        {...props}
        label="Default Overdue Reminder Message"
        field="default_overdue_reminder_message"
      />
      <p className="text-xs text-slate-400">
        Available placeholders: client_name, invoice_number, amount, due_date,
        and company_name. Wrap each placeholder name in double curly braces when
        using it.
      </p>
    </div>
  );
}
function RecurringSection(props: SectionProps) {
  return (
    <Grid>
      <Select
        {...props}
        label="Default Frequency"
        field="default_recurring_frequency"
        options={["monthly", "quarterly", "annually", "custom"]}
      />
      <Select
        {...props}
        label="Default Currency"
        field="default_currency"
        options={["USD", "CAD", "INR"]}
      />
      <Field
        {...props}
        label="Default Payment Terms"
        field="default_payment_terms_days"
        type="number"
        min="0"
      />
      <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3">
        <input
          type="checkbox"
          checked={Boolean(props.settings.default_recurring_generate_as_draft)}
          onChange={(event) =>
            props.update(
              "default_recurring_generate_as_draft",
              event.target.checked,
            )
          }
          className="h-4 w-4 accent-[#153E90]"
        />
        <span className="text-sm font-semibold text-slate-700">
          Generate new recurring invoices as Draft
        </span>
      </label>
    </Grid>
  );
}
function RegionalSection(props: SectionProps) {
  return (
    <Grid>
      <Select
        {...props}
        label="Timezone"
        field="timezone"
        options={[
          "Asia/Kolkata",
          "America/Calgary",
          "America/Toronto",
          "America/New_York",
          "America/Los_Angeles",
          "UTC",
        ]}
      />
      <Select
        {...props}
        label="Date Format"
        field="date_format"
        options={["DD MMM YYYY", "DD-MM-YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]}
      />
      <Select
        {...props}
        label="Time Format"
        field="time_format"
        options={["12h", "24h"]}
      />
    </Grid>
  );
}

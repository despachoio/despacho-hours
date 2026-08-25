"use client";

import { useEffect, useMemo, useState } from "react";
import TimeOffIcon, {
  type TimeOffIconName,
} from "@/components/time-off/TimeOffIcon";
import { supabase } from "@/lib/supabase";
import type {
  PricingPhase,
  WorkOrderInput,
  WorkOrderListItem,
} from "@/lib/work-orders/types";

type Contact = {
  name: string | null;
  email: string;
  phone: string | null;
  is_primary: boolean;
  is_active: boolean;
};
type Bootstrap = {
  clients: Array<{
    id: string;
    name: string;
    business_client_id: number | null;
    client_contacts: Contact[];
  }>;
  terms: Array<{ id: string; name: string; version: string }>;
};
type Reservation = {
  id: string;
  sequence_number: number;
  work_order_number: string;
  business_client_id: number | null;
};
type DetailValue = string | number | boolean | null;
type Detail = {
  workOrder: Record<string, DetailValue>;
  pricingPhases: Array<Record<string, DetailValue>>;
  versions: Array<Record<string, DetailValue>>;
  audit: Array<Record<string, DetailValue>>;
};
type Duplicate = {
  id: string;
  name: string;
  business_client_id: number | null;
};
type PendingAction =
  | "download"
  | "edit"
  | "sent"
  | "signed"
  | "revision"
  | "delete"
  | "cancel"
  | "client"
  | "project"
  | null;
const tabs: ReadonlyArray<{
  value: "create" | "generated";
  label: string;
  icon: TimeOffIconName;
}> = [
  { value: "create", label: "Create Work Order", icon: "document" },
  { value: "generated", label: "Generated Work Orders", icon: "folder" },
];
const inputClass =
  "h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100";
const blank: WorkOrderInput = {
  customerType: "new_client",
  companyName: "",
  templateType: "standard_dedicated_va",
  commercialModel: "fixed_monthly_per_resource",
  billingBasis: "per_resource",
  currency: "USD",
  effectiveDate: "",
  projectStartDate: "",
  endingType: "ongoing",
  serviceType: "Dedicated Virtual Assistant",
  engagementModel: "Full-Time Dedicated",
  engagementOverview: "",
  paymentTermsDays: 7,
  location: "Remote",
  resourceCount: 1,
  hoursPerResourceMonth: 160,
  pricingPhases: [],
};

function Field({
  label,
  required,
  children,
  className = "",
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-[.1em] text-slate-500">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  );
}
function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-blue-100 bg-gradient-to-r from-blue-50 via-white to-cyan-50 px-6 py-4">
        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </header>
      <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-3">
        {children}
      </div>
    </section>
  );
}
function Status({ value }: { value: string }) {
  const styles =
    value === "signed" || value === "onboarded"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : value === "cancelled"
        ? "bg-red-50 text-red-700 ring-red-200"
        : "bg-blue-50 text-[#153E90] ring-blue-200";
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-bold capitalize ring-1 ${styles}`}
    >
      {value}
    </span>
  );
}
const numberValue = (value: string) =>
  value === "" ? undefined : Number(value);

export default function WorkOrdersWorkspace() {
  const [tab, setTab] = useState<"create" | "generated">("create");
  const [boot, setBoot] = useState<Bootstrap>({ clients: [], terms: [] });
  const [form, setForm] = useState<WorkOrderInput>(blank);
  const [identity, setIdentity] = useState<Reservation | null>(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [filters, setFilters] = useState({
    number: "",
    company: "",
    status: "",
    from: "",
    to: "",
  });
  const [rows, setRows] = useState<WorkOrderListItem[]>([]);
  const [searched, setSearched] = useState(false);
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [detailFeedback, setDetailFeedback] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);
  const [duplicates, setDuplicates] = useState<Duplicate[]>([]);
  const [project, setProject] = useState({ code: "", name: "" });
  const set = <K extends keyof WorkOrderInput>(
    key: K,
    value: WorkOrderInput[K],
  ) => setForm((current) => ({ ...current, [key]: value }));
  async function request(url: string, init?: RequestInit) {
    const { data } = await supabase.auth.getSession();
    const response = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${data.session?.access_token}`,
        ...init?.headers,
      },
    });
    const payload = await response.json();
    if (!response.ok)
      throw new Error(payload.error || "Work Order operation failed");
    return payload;
  }
  useEffect(() => {
    void request("/api/work-orders?mode=bootstrap")
      .then((data: Bootstrap) => {
        setBoot(data);
        setForm((current) => ({
          ...current,
          termsTemplateId: current.termsTemplateId || data.terms[0]?.id,
        }));
      })
      .catch((error) => setMessage(error.message));
  }, []);
  const selectedClient = useMemo(
    () => boot.clients.find((client) => client.id === form.clientId),
    [boot.clients, form.clientId],
  );
  const formHasMeaningfulData = useMemo(() => {
    const current = { ...form } as Record<string, unknown>;
    const defaults = {
      ...blank,
      termsTemplateId: boot.terms[0]?.id,
    } as Record<string, unknown>;
    delete current.reservationId;
    delete defaults.reservationId;
    return JSON.stringify(current) !== JSON.stringify(defaults);
  }, [boot.terms, form]);

  function friendlyActionError(error: unknown, fallback: string) {
    const text = error instanceof Error ? error.message : "";
    if (/permission|forbidden|unauthorized/i.test(text))
      return "You do not have permission to complete this Work Order action.";
    if (/network|fetch/i.test(text))
      return "The action could not reach Kairo. Check your connection and try again.";
    return fallback;
  }

  function resetForm() {
    if (
      formHasMeaningfulData &&
      !window.confirm(
        "Reset this Work Order form? All unsaved information will be cleared.",
      )
    )
      return;
    const editingExisting = Boolean(form.id);
    setForm({
      ...blank,
      termsTemplateId: boot.terms[0]?.id,
      reservationId: editingExisting ? undefined : form.reservationId,
    });
    if (editingExisting) setIdentity(null);
    setMessage("");
    setDuplicates([]);
    setProject({ code: "", name: "" });
  }
  async function reserve() {
    setBusy("reserve");
    setMessage("");
    try {
      const result = await request("/api/work-orders", {
        method: "POST",
        body: JSON.stringify({
          action: "reserve",
          newClient: form.customerType === "new_client",
        }),
      });
      setIdentity(result);
      set("reservationId", result.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Reservation failed");
    } finally {
      setBusy("");
    }
  }
  async function save(generate: boolean) {
    setBusy(generate ? "generate" : "save");
    setMessage("");
    try {
      let input = form;
      if (!form.id && !form.reservationId) {
        const reserved = await request("/api/work-orders", {
          method: "POST",
          body: JSON.stringify({
            action: "reserve",
            newClient: form.customerType === "new_client",
          }),
        });
        setIdentity(reserved);
        input = { ...form, reservationId: reserved.id };
        setForm(input);
      }
      const result = await request("/api/work-orders", {
        method: "POST",
        body: JSON.stringify({ action: generate ? "generate" : "save", input }),
      });
      setForm((current) => ({ ...current, id: result.id }));
      setMessage(
        generate
          ? `Work Order ${result.work_order_number} generated successfully.`
          : `Draft ${result.work_order_number} saved.`,
      );
      if (generate) {
        setTab("generated");
        await search(1);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed");
    } finally {
      setBusy("");
    }
  }
  async function search(nextPage = 1) {
    setBusy("search");
    try {
      const result = await request(
        `/api/work-orders?${new URLSearchParams({ ...filters, page: String(nextPage) })}`,
      );
      setRows(result.rows);
      setCount(result.count || 0);
      setPage(nextPage);
      setSearched(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Search failed");
    } finally {
      setBusy("");
    }
  }
  async function openDetail(id: string) {
    setBusy(`detail-${id}`);
    try {
      setDetail(await request(`/api/work-orders?mode=detail&id=${id}`));
      setDetailFeedback(null);
      setDuplicates([]);
      setProject({ code: "", name: "" });
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to load Work Order",
      );
    } finally {
      setBusy("");
    }
  }
  async function action(
    name: string,
    id: string,
    extra: Record<string, unknown> = {},
  ) {
    const nextPending: PendingAction =
      name === "revision"
        ? "revision"
        : name === "delete"
          ? "delete"
          : name === "create_client"
            ? "client"
            : name === "create_project"
              ? "project"
              : name === "status" && extra.status === "sent"
                ? "sent"
                : name === "status" && extra.status === "signed"
                  ? "signed"
                  : name === "status" && extra.status === "cancelled"
                    ? "cancel"
                    : null;
    if (nextPending) setPendingAction(nextPending);
    setDetailFeedback(null);
    setBusy(`${name}-${id}`);
    try {
      const result = await request("/api/work-orders", {
        method: "POST",
        body: JSON.stringify({ action: name, id, ...extra }),
      });
      if (name === "create_client" && result.requiresDecision) {
        setDuplicates(result.candidates);
        return;
      }
      setMessage("Work Order updated successfully.");
      await openDetail(name === "revision" ? result.id : id);
      setDetailFeedback({
        kind: "success",
        text:
          nextPending === "revision"
            ? "Revision created successfully."
            : nextPending === "cancel"
              ? "Work Order cancelled successfully."
              : "Work Order updated successfully.",
      });
      await search(page);
    } catch (error) {
      const text = friendlyActionError(
        error,
        "This Work Order action could not be completed. Please try again.",
      );
      setMessage(text);
      setDetailFeedback({ kind: "error", text });
    } finally {
      setBusy("");
      setPendingAction(null);
    }
  }
  async function download(row: { id: string; work_order_number?: string }) {
    setPendingAction("download");
    setDetailFeedback(null);
    setBusy(`pdf-${row.id}`);
    try {
      const { data } = await supabase.auth.getSession();
      const response = await fetch(`/api/work-orders/${row.id}/pdf`, {
        headers: { Authorization: `Bearer ${data.session?.access_token}` },
      });
      if (!response.ok) throw new Error((await response.json()).error);
      const href = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = `Work_Order_${row.work_order_number || row.id}.pdf`;
      anchor.click();
      URL.revokeObjectURL(href);
      setDetailFeedback({
        kind: "success",
        text: "Work Order PDF downloaded successfully.",
      });
    } catch (error) {
      const text = friendlyActionError(
        error,
        "The Work Order PDF could not be downloaded. Please try again.",
      );
      setMessage(text);
      setDetailFeedback({ kind: "error", text });
    } finally {
      setBusy("");
      setPendingAction(null);
    }
  }
  function addPhase() {
    set("pricingPhases", [
      ...(form.pricingPhases || []),
      {
        label: `Phase ${(form.pricingPhases?.length || 0) + 1}`,
        amount: 0,
        currency: form.currency,
        billingBasis: form.billingBasis,
      },
    ]);
  }
  function updatePhase(index: number, patch: Partial<PricingPhase>) {
    set(
      "pricingPhases",
      (form.pricingPhases || []).map((phase, i) =>
        i === index ? { ...phase, ...patch } : phase,
      ),
    );
  }
  function loadForEdit(data: Detail) {
    const row = data.workOrder;
    setForm({
      id: String(row.id),
      reservationId: String(row.reservation_id),
      customerType: row.customer_type as WorkOrderInput["customerType"],
      clientId: String(row.client_id || "") || undefined,
      companyName: String(row.company_name || ""),
      contactName: String(row.contact_name || ""),
      email: String(row.email || ""),
      phone: String(row.phone || ""),
      address: String(row.address || ""),
      city: String(row.city || ""),
      state: String(row.state || ""),
      postalCode: String(row.postal_code || ""),
      country: String(row.country || ""),
      templateType: String(row.template_type),
      commercialModel: String(row.commercial_model),
      billingBasis: String(row.billing_basis),
      resourceCount: Number(row.resource_count) || undefined,
      hoursPerResourceMonth: Number(row.hours_per_resource_month) || undefined,
      hoursPerDay: Number(row.hours_per_day) || undefined,
      daysPerWeek: Number(row.days_per_week) || undefined,
      workingCommitmentCustom: String(row.working_commitment_custom || ""),
      currency: row.currency as WorkOrderInput["currency"],
      monthlyFee: Number(row.monthly_fee) || undefined,
      pricingNotes: String(row.pricing_notes || ""),
      pricingPhases: data.pricingPhases.map((phase) => ({
        label: String(phase.label),
        description: String(phase.description || ""),
        startMonth: Number(phase.start_month) || undefined,
        endMonth: Number(phase.end_month) || undefined,
        amount: Number(phase.amount),
        currency: phase.currency as PricingPhase["currency"],
        billingBasis: String(phase.billing_basis),
      })),
      location: String(row.location || ""),
      rateIncreaseTerms: String(row.rate_increase_terms || ""),
      effectiveDate: String(row.effective_date || ""),
      firstInvoiceDate: String(row.first_invoice_date || ""),
      projectStartDate: String(row.project_start_date || ""),
      endingType: row.ending_type as WorkOrderInput["endingType"],
      endDate: String(row.end_date || ""),
      serviceType: String(row.service_type || ""),
      engagementModel: String(row.engagement_model || ""),
      engagementOverview: String(row.engagement_overview || ""),
      paymentTermsDays: Number(row.payment_terms_days) || undefined,
      paymentTermsCustom: String(row.payment_terms_custom || ""),
      latePaymentTerms: String(row.late_payment_terms || ""),
      longTermClauseEnabled: Boolean(row.long_term_clause_enabled),
      futureHiresClauseEnabled: Boolean(row.future_hires_clause_enabled),
      additionalHeadcountClauseEnabled: Boolean(
        row.additional_headcount_clause_enabled,
      ),
      premiumWorkClauseEnabled: Boolean(row.premium_work_clause_enabled),
      customTerms: String(row.custom_terms || ""),
      termsTemplateId: String(row.terms_template_id || ""),
    });
    setIdentity({
      id: String(row.reservation_id),
      sequence_number: Number(row.sequence_number),
      work_order_number: String(row.work_order_number),
      business_client_id: Number(row.client_business_id) || null,
    });
    setDetail(null);
    setTab("create");
  }

  return (
    <div className="space-y-6">
      <nav
        aria-label="Work Order sections"
        className="flex min-h-[64px] items-center gap-2 overflow-x-auto rounded-2xl border border-blue-800/60 bg-gradient-to-r from-indigo-950 via-blue-900 to-cyan-800 p-2.5 shadow-[0_22px_52px_-30px_rgba(15,23,42,.9)]"
      >
        {tabs.map((item) => (
          <button
            key={item.value}
            onClick={() => setTab(item.value)}
            aria-current={tab === item.value ? "page" : undefined}
            className={`flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-4 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 ${tab === item.value ? "bg-white text-[#153E90] shadow-lg shadow-slate-950/20" : "text-blue-100 hover:bg-white/10 hover:text-white"}`}
          >
            <TimeOffIcon name={item.icon} className="h-4 w-4" />
            {item.label}
          </button>
        ))}
      </nav>
      {message && (
        <div
          role="status"
          className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-[#153E90]"
        >
          {message}
        </div>
      )}
      {tab === "create" ? (
        <div className="space-y-5">
          <Card
            title="Work Order Identity"
            subtitle="Reserve a collision-safe number and lock approved legal terms."
          >
            <Field label="Customer Type">
              <select
                className={inputClass}
                value={form.customerType}
                onChange={(event) => {
                  set(
                    "customerType",
                    event.target.value as WorkOrderInput["customerType"],
                  );
                  set("clientId", undefined);
                  set("reservationId", undefined);
                  setIdentity(null);
                }}
              >
                <option value="new_client">New Client</option>
                <option value="existing_client">Existing Client</option>
              </select>
            </Field>
            {form.customerType === "existing_client" && (
              <Field label="Existing Client" required>
                <select
                  className={inputClass}
                  value={form.clientId || ""}
                  onChange={(event) => {
                    const client = boot.clients.find(
                      (item) => item.id === event.target.value,
                    );
                    const contact = client?.client_contacts.find(
                      (item) => item.is_primary && item.is_active,
                    );
                    setForm((current) => ({
                      ...current,
                      clientId: event.target.value,
                      companyName: client?.name || "",
                      contactName: contact?.name || "",
                      email: contact?.email || "",
                      phone: contact?.phone || "",
                    }));
                  }}
                >
                  <option value="">Select client</option>
                  {boot.clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.business_client_id
                        ? `${client.business_client_id} · `
                        : ""}
                      {client.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="Work Order Number">
              <button
                type="button"
                onClick={reserve}
                className={`${inputClass} text-left font-bold text-[#153E90]`}
              >
                {identity?.work_order_number ||
                  (busy === "reserve" ? "Reserving…" : "Reserve next number")}
              </button>
            </Field>
            <Field label="Client ID">
              <div className={`${inputClass} flex items-center text-slate-500`}>
                {form.customerType === "existing_client"
                  ? selectedClient?.business_client_id ||
                    "Retains existing Client ID"
                  : identity?.business_client_id || "Derived when reserved"}
              </div>
            </Field>
            <Field label="Approved Terms" required>
              <select
                className={inputClass}
                value={form.termsTemplateId || ""}
                onChange={(event) => set("termsTemplateId", event.target.value)}
              >
                <option value="">Select version</option>
                {boot.terms.map((term) => (
                  <option key={term.id} value={term.id}>
                    {term.name} · {term.version}
                  </option>
                ))}
              </select>
            </Field>
          </Card>
          <Card title="Customer Details">
            <Field label="Company Name" required>
              <input
                className={inputClass}
                value={form.companyName}
                onChange={(event) => set("companyName", event.target.value)}
              />
            </Field>
            <Field label="Primary Contact">
              <input
                className={inputClass}
                value={form.contactName || ""}
                onChange={(event) => set("contactName", event.target.value)}
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                className={inputClass}
                value={form.email || ""}
                onChange={(event) => set("email", event.target.value)}
              />
            </Field>
            <Field label="Phone">
              <input
                className={inputClass}
                value={form.phone || ""}
                onChange={(event) => set("phone", event.target.value)}
              />
            </Field>
            <Field label="Address">
              <input
                className={inputClass}
                value={form.address || ""}
                onChange={(event) => set("address", event.target.value)}
              />
            </Field>
            <Field label="City">
              <input
                className={inputClass}
                value={form.city || ""}
                onChange={(event) => set("city", event.target.value)}
              />
            </Field>
            <Field label="State / Province">
              <input
                className={inputClass}
                value={form.state || ""}
                onChange={(event) => set("state", event.target.value)}
              />
            </Field>
            <Field label="Postal Code">
              <input
                className={inputClass}
                value={form.postalCode || ""}
                onChange={(event) => set("postalCode", event.target.value)}
              />
            </Field>
            <Field label="Country">
              <input
                className={inputClass}
                value={form.country || ""}
                onChange={(event) => set("country", event.target.value)}
              />
            </Field>
          </Card>
          <Card title="Commercial & Pricing">
            <Field label="Template">
              <select
                className={inputClass}
                value={form.templateType}
                onChange={(event) => set("templateType", event.target.value)}
              >
                <option value="standard_dedicated_va">
                  Standard Dedicated VA
                </option>
                <option value="monthly_subscription">
                  Monthly Subscription
                </option>
                <option value="custom">Custom Work Order</option>
              </select>
            </Field>
            <Field label="Commercial Model">
              <select
                className={inputClass}
                value={form.commercialModel}
                onChange={(event) => set("commercialModel", event.target.value)}
              >
                <option value="fixed_monthly_per_resource">
                  Fixed Monthly Per Resource
                </option>
                <option value="tiered">Tiered / Introductory Pricing</option>
                <option value="hourly">Hourly</option>
                <option value="flat_monthly">Flat Monthly Fee</option>
                <option value="custom">Custom</option>
              </select>
            </Field>
            <Field label="Billing Basis">
              <select
                className={inputClass}
                value={form.billingBasis}
                onChange={(event) => set("billingBasis", event.target.value)}
              >
                <option value="per_resource">Per Resource</option>
                <option value="flat_monthly">Flat Monthly</option>
                <option value="hourly">Hourly</option>
                <option value="custom">Custom</option>
              </select>
            </Field>
            <Field label="Currency">
              <select
                className={inputClass}
                value={form.currency}
                onChange={(event) =>
                  set(
                    "currency",
                    event.target.value as WorkOrderInput["currency"],
                  )
                }
              >
                <option>USD</option>
                <option>CAD</option>
              </select>
            </Field>
            <Field label="Resources">
              <input
                type="number"
                min="0"
                className={inputClass}
                value={form.resourceCount ?? ""}
                onChange={(event) =>
                  set("resourceCount", numberValue(event.target.value))
                }
              />
            </Field>
            <Field label="Monthly Fee">
              <input
                type="number"
                min="0"
                className={inputClass}
                value={form.monthlyFee ?? ""}
                onChange={(event) =>
                  set("monthlyFee", numberValue(event.target.value))
                }
              />
            </Field>
            <Field label="Hours / Resource / Month">
              <input
                type="number"
                min="0"
                className={inputClass}
                value={form.hoursPerResourceMonth ?? ""}
                onChange={(event) =>
                  set("hoursPerResourceMonth", numberValue(event.target.value))
                }
              />
            </Field>
            <Field label="Hours / Day">
              <input
                type="number"
                min="0"
                className={inputClass}
                value={form.hoursPerDay ?? ""}
                onChange={(event) =>
                  set("hoursPerDay", numberValue(event.target.value))
                }
              />
            </Field>
            <Field label="Days / Week">
              <input
                type="number"
                min="0"
                max="7"
                className={inputClass}
                value={form.daysPerWeek ?? ""}
                onChange={(event) =>
                  set("daysPerWeek", numberValue(event.target.value))
                }
              />
            </Field>
            <Field label="Custom Commitment">
              <input
                className={inputClass}
                value={form.workingCommitmentCustom || ""}
                onChange={(event) =>
                  set("workingCommitmentCustom", event.target.value)
                }
              />
            </Field>
            <Field label="Rate Increase Terms">
              <input
                className={inputClass}
                value={form.rateIncreaseTerms || ""}
                onChange={(event) =>
                  set("rateIncreaseTerms", event.target.value)
                }
              />
            </Field>
            <Field label="Pricing Notes">
              <input
                className={inputClass}
                value={form.pricingNotes || ""}
                onChange={(event) => set("pricingNotes", event.target.value)}
              />
            </Field>
            <div className="md:col-span-2 xl:col-span-3">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-bold text-slate-700">
                  Pricing phases
                </p>
                <button
                  type="button"
                  onClick={addPhase}
                  className="rounded-full bg-blue-50 px-4 py-2 text-xs font-bold text-[#153E90]"
                >
                  + Add phase
                </button>
              </div>
              <div className="space-y-3">
                {form.pricingPhases?.map((phase, index) => (
                  <div
                    key={index}
                    className="grid gap-3 rounded-2xl border border-blue-100 bg-blue-50/40 p-4 md:grid-cols-6"
                  >
                    <input
                      aria-label="Phase label"
                      className={inputClass}
                      value={phase.label}
                      onChange={(event) =>
                        updatePhase(index, { label: event.target.value })
                      }
                    />
                    <input
                      aria-label="Start month"
                      type="number"
                      min="1"
                      className={inputClass}
                      placeholder="Start month"
                      value={phase.startMonth ?? ""}
                      onChange={(event) =>
                        updatePhase(index, {
                          startMonth: numberValue(event.target.value),
                        })
                      }
                    />
                    <input
                      aria-label="End month"
                      type="number"
                      min="1"
                      className={inputClass}
                      placeholder="End month"
                      value={phase.endMonth ?? ""}
                      onChange={(event) =>
                        updatePhase(index, {
                          endMonth: numberValue(event.target.value),
                        })
                      }
                    />
                    <input
                      aria-label="Amount"
                      type="number"
                      min="0"
                      className={inputClass}
                      value={phase.amount}
                      onChange={(event) =>
                        updatePhase(index, {
                          amount: Number(event.target.value),
                        })
                      }
                    />
                    <input
                      aria-label="Description"
                      className={inputClass}
                      placeholder="Description"
                      value={phase.description || ""}
                      onChange={(event) =>
                        updatePhase(index, { description: event.target.value })
                      }
                    />
                    <button
                      type="button"
                      onClick={() =>
                        set(
                          "pricingPhases",
                          form.pricingPhases?.filter((_, i) => i !== index),
                        )
                      }
                      className="rounded-xl border border-red-200 text-sm font-bold text-red-600"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </Card>
          <Card title="Service & Engagement">
            <Field label="Service Type" required>
              <input
                className={inputClass}
                value={form.serviceType}
                onChange={(event) => set("serviceType", event.target.value)}
              />
            </Field>
            <Field label="Engagement Model" required>
              <input
                className={inputClass}
                value={form.engagementModel}
                onChange={(event) => set("engagementModel", event.target.value)}
              />
            </Field>
            <Field label="Location">
              <select
                className={inputClass}
                value={form.location || ""}
                onChange={(event) => set("location", event.target.value)}
              >
                <option value="">Not specified</option>
                <option>Remote</option>
                <option>On-site</option>
                <option>Hybrid</option>
                <option>Custom</option>
              </select>
            </Field>
            <Field
              label="Engagement Overview"
              required
              className="md:col-span-2 xl:col-span-3"
            >
              <textarea
                className="min-h-28 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-blue-400"
                value={form.engagementOverview}
                onChange={(event) =>
                  set("engagementOverview", event.target.value)
                }
              />
            </Field>
          </Card>
          <Card title="Dates, Payment & Clauses">
            <Field label="Terms Effective Date" required>
              <input
                type="date"
                className={inputClass}
                value={form.effectiveDate}
                onChange={(event) => set("effectiveDate", event.target.value)}
              />
            </Field>
            <Field label="Project Starting Date" required>
              <input
                type="date"
                className={inputClass}
                value={form.projectStartDate}
                onChange={(event) =>
                  set("projectStartDate", event.target.value)
                }
              />
            </Field>
            <Field label="First Invoice Date">
              <input
                type="date"
                className={inputClass}
                value={form.firstInvoiceDate || ""}
                onChange={(event) =>
                  set("firstInvoiceDate", event.target.value)
                }
              />
            </Field>
            <Field label="Ending">
              <select
                className={inputClass}
                value={form.endingType}
                onChange={(event) =>
                  set(
                    "endingType",
                    event.target.value as WorkOrderInput["endingType"],
                  )
                }
              >
                <option value="ongoing">Ongoing</option>
                <option value="specific_date">Specific Date</option>
                <option value="custom">Custom</option>
              </select>
            </Field>
            {form.endingType === "specific_date" && (
              <Field label="End Date">
                <input
                  type="date"
                  className={inputClass}
                  value={form.endDate || ""}
                  onChange={(event) => set("endDate", event.target.value)}
                />
              </Field>
            )}
            <Field label="Payment Terms">
              <select
                className={inputClass}
                value={form.paymentTermsDays || 0}
                onChange={(event) =>
                  set(
                    "paymentTermsDays",
                    Number(event.target.value) || undefined,
                  )
                }
              >
                <option value="7">7 days</option>
                <option value="15">15 days</option>
                <option value="30">30 days</option>
                <option value="0">Custom</option>
              </select>
            </Field>
            {!form.paymentTermsDays && (
              <Field label="Custom Payment Terms">
                <input
                  className={inputClass}
                  value={form.paymentTermsCustom || ""}
                  onChange={(event) =>
                    set("paymentTermsCustom", event.target.value)
                  }
                />
              </Field>
            )}
            <Field label="Late Payment Terms">
              <input
                className={inputClass}
                value={form.latePaymentTerms || ""}
                onChange={(event) =>
                  set("latePaymentTerms", event.target.value)
                }
              />
            </Field>
            <div className="grid gap-2 md:col-span-2 xl:col-span-3 sm:grid-cols-2">
              {(
                [
                  ["longTermClauseEnabled", "Long-term engagement"],
                  ["futureHiresClauseEnabled", "Future hires"],
                  ["additionalHeadcountClauseEnabled", "Additional headcount"],
                  ["premiumWorkClauseEnabled", "Premium work"],
                ] as const
              ).map(([key, label]) => (
                <label
                  key={key}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold"
                >
                  <input
                    type="checkbox"
                    checked={Boolean(form[key])}
                    onChange={(event) => set(key, event.target.checked)}
                  />
                  {label}
                </label>
              ))}
            </div>
            <Field label="Custom Terms" className="md:col-span-2 xl:col-span-3">
              <textarea
                className="min-h-24 w-full rounded-xl border border-slate-200 p-3 text-sm"
                value={form.customTerms || ""}
                onChange={(event) => set("customTerms", event.target.value)}
              />
            </Field>
          </Card>
          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              disabled={!!busy}
              onClick={resetForm}
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-bold text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-[#153E90] disabled:opacity-50"
            >
              Reset
            </button>
            <button
              disabled={!!busy}
              onClick={() => save(false)}
              className="rounded-xl border border-blue-200 bg-white px-5 py-3 font-bold text-[#153E90] disabled:opacity-50"
            >
              {busy === "save" ? "Saving…" : "Save Draft"}
            </button>
            <button
              disabled={!!busy}
              onClick={() => save(true)}
              className="rounded-xl bg-gradient-to-r from-[#153E90] to-blue-700 px-5 py-3 font-bold text-white shadow-lg disabled:opacity-50"
            >
              {busy === "generate" ? "Generating…" : "Generate Work Order"}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <section className="rounded-3xl border bg-white p-6 shadow-sm">
            <div className="grid gap-3 md:grid-cols-5">
              <input
                className={inputClass}
                placeholder="Work Order #"
                value={filters.number}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    number: event.target.value,
                  }))
                }
              />
              <input
                className={inputClass}
                placeholder="Company"
                value={filters.company}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    company: event.target.value,
                  }))
                }
              />
              <select
                className={inputClass}
                value={filters.status}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    status: event.target.value,
                  }))
                }
              >
                <option value="">All statuses</option>
                {[
                  "draft",
                  "generated",
                  "sent",
                  "signed",
                  "onboarded",
                  "cancelled",
                ].map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
              <input
                type="date"
                className={inputClass}
                value={filters.from}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    from: event.target.value,
                  }))
                }
              />
              <input
                type="date"
                className={inputClass}
                value={filters.to}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    to: event.target.value,
                  }))
                }
              />
            </div>
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => search(1)}
                className="rounded-xl bg-[#153E90] px-5 py-2.5 font-bold text-white"
              >
                {busy === "search" ? "Searching…" : "Search"}
              </button>
              <button
                onClick={() => {
                  setFilters({
                    number: "",
                    company: "",
                    status: "",
                    from: "",
                    to: "",
                  });
                  setRows([]);
                  setSearched(false);
                }}
                className="rounded-xl border px-5 py-2.5 font-bold text-slate-600"
              >
                Reset
              </button>
            </div>
          </section>
          <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
            <div className="flex items-center justify-between border-b px-6 py-5">
              <div>
                <h3 className="text-lg font-bold">Generated Work Orders</h3>
                <p className="text-sm text-slate-500">
                  Search, review, download, revise and onboard.
                </p>
              </div>
              {searched && (
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-[#153E90]">
                  {count} records
                </span>
              )}
            </div>
            {!searched ? (
              <div className="p-16 text-center text-slate-400">
                Choose filters and click Search.
              </div>
            ) : rows.length === 0 ? (
              <div className="p-16 text-center text-slate-400">
                No Work Orders match these filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1180px] text-left text-sm">
                  <thead className="bg-[#0F172A] text-white">
                    <tr>
                      {[
                        "Work Order",
                        "Client",
                        "Client ID",
                        "Model",
                        "Resources",
                        "Fee",
                        "Effective",
                        "Status",
                        "Version",
                        "Actions",
                      ].map((header) => (
                        <th key={header} className="px-4 py-3">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} className="border-b hover:bg-blue-50/40">
                        <td className="px-4 py-4 font-bold text-[#153E90]">
                          {row.work_order_number}
                        </td>
                        <td className="px-4">{row.company_name}</td>
                        <td className="px-4">
                          {row.client_business_id || "Existing"}
                        </td>
                        <td className="px-4 capitalize">
                          {row.commercial_model.replaceAll("_", " ")}
                        </td>
                        <td className="px-4">{row.resource_count ?? "—"}</td>
                        <td className="px-4">
                          {row.monthly_fee
                            ? `${row.currency} ${Number(row.monthly_fee).toLocaleString()}`
                            : "Custom"}
                        </td>
                        <td className="px-4">{row.effective_date}</td>
                        <td className="px-4">
                          <Status value={row.status} />
                        </td>
                        <td className="px-4">v{row.current_version}</td>
                        <td className="px-4">
                          <div className="flex gap-2">
                            <button
                              onClick={() => openDetail(row.id)}
                              className="rounded-full border border-blue-200 px-3 py-2 font-bold text-[#153E90]"
                            >
                              {busy === `detail-${row.id}`
                                ? "Opening…"
                                : "View"}
                            </button>
                            <button
                              disabled={
                                !row.current_version || busy === `pdf-${row.id}`
                              }
                              onClick={() => download(row)}
                              className="rounded-full bg-[#153E90] px-3 py-2 font-bold text-white disabled:bg-slate-300"
                            >
                              {busy === `pdf-${row.id}`
                                ? "Downloading…"
                                : "PDF"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {searched && count > 25 && (
              <div className="flex justify-end gap-2 p-4">
                <button
                  disabled={page === 1}
                  onClick={() => search(page - 1)}
                  className="rounded-lg border px-3 py-2 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  disabled={page * 25 >= count}
                  onClick={() => search(page + 1)}
                  className="rounded-lg border px-3 py-2 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </section>
        </div>
      )}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-busy={pendingAction !== null}
            className="relative max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white shadow-2xl"
          >
            <header className="sticky top-0 z-10 flex items-start justify-between border-b bg-gradient-to-r from-[#0F172A] to-[#153E90] px-7 py-6 text-white">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-200">
                  Work Order Detail
                </p>
                <h2 className="mt-1 text-2xl font-bold">
                  {String(detail.workOrder.work_order_number)} ·{" "}
                  {String(detail.workOrder.company_name)}
                </h2>
                <div className="mt-2">
                  <Status value={String(detail.workOrder.status)} />
                </div>
              </div>
              <button
                aria-label="Close"
                disabled={pendingAction !== null}
                onClick={() => setDetail(null)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xl disabled:cursor-not-allowed disabled:opacity-40"
              >
                ×
              </button>
            </header>
            <div className="space-y-6 p-7">
              {detailFeedback && (
                <div
                  role={detailFeedback.kind === "error" ? "alert" : "status"}
                  className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${detailFeedback.kind === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}
                >
                  {detailFeedback.text}
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["Version", `v${detail.workOrder.current_version}`],
                  ["Terms", String(detail.workOrder.terms_version || "—")],
                  ["Effective", String(detail.workOrder.effective_date)],
                  [
                    "Project Start",
                    String(detail.workOrder.project_start_date),
                  ],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-2xl border bg-slate-50 p-4"
                  >
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      {label}
                    </p>
                    <p className="mt-2 font-bold text-slate-900">{value}</p>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  disabled={pendingAction !== null}
                  onClick={() =>
                    download({
                      id: String(detail.workOrder.id),
                      work_order_number: String(
                        detail.workOrder.work_order_number,
                      ),
                    })
                  }
                  className="min-w-36 rounded-full bg-[#153E90] px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {pendingAction === "download" ? "Downloading…" : "Download PDF"}
                </button>
                {["draft", "generated"].includes(
                  String(detail.workOrder.status),
                ) && (
                  <button
                    disabled={pendingAction !== null}
                    onClick={() => loadForEdit(detail)}
                    className="min-w-24 rounded-full border border-blue-200 px-4 py-2 text-sm font-bold text-[#153E90] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {pendingAction === "edit" ? "Opening…" : "Edit"}
                  </button>
                )}
                {String(detail.workOrder.status) === "generated" && (
                  <button
                    disabled={pendingAction !== null}
                    onClick={() =>
                      action("status", String(detail.workOrder.id), {
                        status: "sent",
                      })
                    }
                    className="min-w-32 rounded-full bg-cyan-600 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {pendingAction === "sent" ? "Marking Sent…" : "Mark Sent"}
                  </button>
                )}
                {String(detail.workOrder.status) === "sent" && (
                  <button
                    disabled={pendingAction !== null}
                    onClick={() =>
                      action("status", String(detail.workOrder.id), {
                        status: "signed",
                      })
                    }
                    className="min-w-32 rounded-full bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {pendingAction === "signed" ? "Marking Signed…" : "Mark Signed"}
                  </button>
                )}
                {["generated", "sent", "signed"].includes(
                  String(detail.workOrder.status),
                ) && (
                  <button
                    disabled={pendingAction !== null}
                    onClick={() =>
                      action("revision", String(detail.workOrder.id))
                    }
                    className="min-w-40 rounded-full bg-violet-600 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {pendingAction === "revision" ? "Creating Revision…" : "Create Revision"}
                  </button>
                )}
                {String(detail.workOrder.status) === "draft" && (
                  <button
                    disabled={pendingAction !== null}
                    onClick={() =>
                      action("delete", String(detail.workOrder.id)).then(() =>
                        setDetail(null),
                      )
                    }
                    className="min-w-32 rounded-full bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {pendingAction === "delete" ? "Deleting…" : "Delete Draft"}
                  </button>
                )}
                {["draft", "generated", "sent"].includes(
                  String(detail.workOrder.status),
                ) && (
                  <button
                    disabled={pendingAction !== null}
                    onClick={() =>
                      action("status", String(detail.workOrder.id), {
                        status: "cancelled",
                      })
                    }
                    className="min-w-44 rounded-full border border-red-200 px-4 py-2 text-sm font-bold text-red-600 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                  >
                    {pendingAction === "cancel" ? "Cancelling…" : "Cancel Work Order"}
                  </button>
                )}
              </div>
              {String(detail.workOrder.status) === "signed" && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                  <h3 className="font-bold text-emerald-900">
                    Client & Project Onboarding
                  </h3>
                  {!detail.workOrder.client_id && (
                    <button
                      disabled={pendingAction !== null}
                      onClick={() =>
                        action("create_client", String(detail.workOrder.id))
                      }
                      className="mt-3 rounded-xl bg-emerald-700 px-4 py-2 font-bold text-white disabled:bg-slate-300"
                    >
                      {pendingAction === "client" ? "Processing…" : "Create or Link Client"}
                    </button>
                  )}
                  {duplicates.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <p className="text-sm font-semibold text-amber-800">
                        Possible duplicate Clients found. Choose the existing
                        account to link.
                      </p>
                      {duplicates.map((candidate) => (
                        <button
                          key={candidate.id}
                          disabled={pendingAction !== null}
                          onClick={() =>
                            action(
                              "create_client",
                              String(detail.workOrder.id),
                              { existingClientId: candidate.id },
                            )
                          }
                          className="mr-2 rounded-full border border-amber-300 bg-white px-3 py-2 text-sm font-bold"
                        >
                          Link {candidate.business_client_id} · {candidate.name}
                        </button>
                      ))}
                      <button
                        disabled={pendingAction !== null}
                        onClick={() =>
                          action("create_client", String(detail.workOrder.id), {
                            existingClientId: "__create_new__",
                          })
                        }
                        className="rounded-full bg-amber-700 px-3 py-2 text-sm font-bold text-white"
                      >
                        Create a separate Client anyway
                      </button>
                    </div>
                  )}
                  {detail.workOrder.client_id && (
                    <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                      <input
                        className={inputClass}
                        placeholder="Project code"
                        value={project.code}
                        onChange={(event) =>
                          setProject((current) => ({
                            ...current,
                            code: event.target.value,
                          }))
                        }
                      />
                      <input
                        className={inputClass}
                        placeholder="Project name"
                        value={project.name}
                        onChange={(event) =>
                          setProject((current) => ({
                            ...current,
                            name: event.target.value,
                          }))
                        }
                      />
                      <button
                        disabled={pendingAction !== null}
                        onClick={() =>
                          action(
                            "create_project",
                            String(detail.workOrder.id),
                            {
                              projectCode: project.code,
                              projectName: project.name,
                            },
                          )
                        }
                        className="rounded-xl bg-[#153E90] px-4 font-bold text-white disabled:bg-slate-300"
                      >
                        {pendingAction === "project" ? "Creating…" : "Create Project"}
                      </button>
                    </div>
                  )}
                </div>
              )}
              <div className="grid gap-6 lg:grid-cols-2">
                <div>
                  <h3 className="mb-3 text-lg font-bold">
                    Commercial Snapshot
                  </h3>
                  <div className="rounded-2xl border p-4 text-sm leading-7 text-slate-600">
                    <p>
                      <b>Service:</b> {String(detail.workOrder.service_type)}
                    </p>
                    <p>
                      <b>Engagement:</b>{" "}
                      {String(detail.workOrder.engagement_model)}
                    </p>
                    <p>
                      <b>Resources:</b>{" "}
                      {String(detail.workOrder.resource_count ?? "—")}
                    </p>
                    <p>
                      <b>Fee:</b>{" "}
                      {detail.workOrder.monthly_fee
                        ? `${String(detail.workOrder.currency)} ${Number(detail.workOrder.monthly_fee).toLocaleString()}`
                        : "Custom pricing"}
                    </p>
                    <p>
                      <b>Overview:</b>{" "}
                      {String(detail.workOrder.engagement_overview)}
                    </p>
                  </div>
                </div>
                <div>
                  <h3 className="mb-3 text-lg font-bold">Activity</h3>
                  <div className="max-h-64 space-y-3 overflow-y-auto">
                    {detail.audit.map((entry, index) => (
                      <div
                        key={String(entry.id || index)}
                        className="rounded-2xl border border-slate-200 p-3"
                      >
                        <p className="font-bold capitalize text-slate-800">
                          {String(entry.action).replaceAll("_", " ")}
                        </p>
                        <p className="text-xs text-slate-500">
                          {new Date(String(entry.created_at)).toLocaleString()}{" "}
                          · {String(entry.actor_role)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            {pendingAction &&
              ["sent", "revision", "cancel"].includes(pendingAction) && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/75 p-6 backdrop-blur-[2px]">
                  <div
                    role="status"
                    className="flex items-center gap-3 rounded-2xl border border-blue-100 bg-white px-6 py-4 font-bold text-[#153E90] shadow-xl"
                  >
                    <span
                      aria-hidden="true"
                      className="h-5 w-5 animate-spin rounded-full border-2 border-blue-200 border-t-[#153E90]"
                    />
                    {pendingAction === "sent"
                      ? "Marking Work Order as sent…"
                      : pendingAction === "revision"
                        ? "Creating a new revision…"
                        : "Cancelling Work Order…"}
                  </div>
                </div>
              )}
          </section>
        </div>
      )}
    </div>
  );
}

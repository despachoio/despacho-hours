"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import KairoButton from "@/components/ui/KairoButton";
import KairoCard from "@/components/ui/KairoCard";
import KairoInput from "@/components/ui/KairoInput";
import KairoSelect from "@/components/ui/KairoSelect";
import KairoTextarea from "@/components/ui/KairoTextarea";

type Client = { id: string; name: string; client_contacts?: { email: string; contact_type: string; is_primary: boolean; is_active: boolean }[] };
type Project = { id: string; client_id: string; name: string; project_code: string | null };
type Item = { project_id: string; description: string; hours: string; quantity: string; unit_price: string; amount: string };
type Props = { scheduleId?: string; scheduledDate?: string; sourceInvoiceId?: string | null };

const emptyItem = (): Item => ({ project_id: "", description: "", hours: "", quantity: "1", unit_price: "", amount: "" });
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const addDays = (value: string, days: number) => { const date = new Date(`${value}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); };

export default function RecurringScheduleForm({ scheduleId, scheduledDate, sourceInvoiceId }: Props) {
  const router = useRouter();
  const occurrenceMode = Boolean(scheduleId && scheduledDate);
  const editMode = Boolean(scheduleId && !scheduledDate);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState(""); const [clientId, setClientId] = useState("");
  const [frequency, setFrequency] = useState("monthly"); const [intervalCount, setIntervalCount] = useState("1");
  const [startDate, setStartDate] = useState(today()); const [endDate, setEndDate] = useState(""); const [nextDate, setNextDate] = useState(today());
  const [issueDate, setIssueDate] = useState(scheduledDate || today()); const [dueDate, setDueDate] = useState(addDays(scheduledDate || today(), 7));
  const [terms, setTerms] = useState("7"); const [currency, setCurrency] = useState("USD");
  const [tax, setTax] = useState("0"); const [discount, setDiscount] = useState("0"); const [notes, setNotes] = useState("");
  const [emailTo, setEmailTo] = useState(""); const [emailCc, setEmailCc] = useState("sales@despacho.io");
  const [subject, setSubject] = useState(""); const [body, setBody] = useState("");
  const [autoSend, setAutoSend] = useState(false); const [autopay, setAutopay] = useState(false);
  const [items, setItems] = useState<Item[]>([emptyItem()]); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const [clientResult, projectResult] = await Promise.all([
        supabase.from("clients").select("id,name,client_contacts(email,contact_type,is_primary,is_active)").eq("status", "active").order("name"),
        supabase.from("projects").select("id,client_id,name,project_code").eq("status", "active").order("name"),
      ]);
      setClients((clientResult.data || []) as unknown as Client[]); setProjects((projectResult.data || []) as Project[]);

      if (scheduleId) {
        const [scheduleResult, defaultItems, occurrenceResult] = await Promise.all([
          supabase.from("recurring_invoice_schedules").select("*").eq("id", scheduleId).single(),
          supabase.from("recurring_invoice_items").select("project_id,description,hours,quantity,unit_price,amount").eq("recurring_schedule_id", scheduleId).order("sort_order"),
          scheduledDate ? supabase.from("recurring_invoice_occurrences").select("*,recurring_invoice_occurrence_items(project_id,description,hours,quantity,unit_price,amount,sort_order)").eq("recurring_schedule_id", scheduleId).eq("scheduled_date", scheduledDate).maybeSingle() : Promise.resolve({ data: null, error: null }),
        ]);
        if (scheduleResult.error || !scheduleResult.data) { setError("Schedule not found."); setLoading(false); return; }
        const schedule = scheduleResult.data; const occurrence = occurrenceResult.data;
        setName(schedule.name); setClientId(schedule.client_id); setFrequency(schedule.frequency); setIntervalCount(String(schedule.interval_count)); setStartDate(schedule.start_date); setEndDate(schedule.end_date || ""); setNextDate(schedule.next_generation_date);
        setTerms(String(schedule.payment_terms_days)); setCurrency(occurrence?.currency || schedule.currency); setTax(String(occurrence?.tax_amount ?? schedule.tax_amount)); setDiscount(String(occurrence?.discount_amount ?? schedule.discount_amount)); setNotes(occurrence?.notes ?? schedule.notes ?? "");
        setEmailTo(occurrence?.email_to ?? schedule.email_to ?? ""); setEmailCc(occurrence?.email_cc ?? schedule.email_cc ?? ""); setSubject(occurrence?.email_subject ?? schedule.email_subject ?? ""); setBody(occurrence?.email_body ?? schedule.email_body ?? ""); setAutoSend(schedule.auto_send); setAutopay(schedule.autopay_enabled);
        if (scheduledDate) { setIssueDate(occurrence?.issue_date || scheduledDate); setDueDate(occurrence?.due_date || addDays(scheduledDate, Number(schedule.payment_terms_days || 7))); }
        const occurrenceItems = occurrence?.recurring_invoice_occurrence_items || []; const loaded = occurrenceItems.length ? occurrenceItems : defaultItems.data || [];
        setItems(loaded.map((item: Record<string, unknown>) => ({ project_id: String(item.project_id || ""), description: String(item.description || ""), hours: String(item.hours ?? ""), quantity: String(item.quantity ?? 1), unit_price: String(item.unit_price ?? ""), amount: String(item.amount ?? "") })));
      } else if (sourceInvoiceId) {
        const [invoiceResult, itemResult] = await Promise.all([
          supabase.from("invoices").select("invoice_number,client_id,currency,tax_amount,discount_amount,notes,sent_to,sent_cc,email_subject,email_body,issue_date,due_date").eq("id", sourceInvoiceId).single(),
          supabase.from("invoice_items").select("project_id,description,hours,quantity,unit_price,amount").eq("invoice_id", sourceInvoiceId),
        ]);
        if (invoiceResult.data) {
          const invoice = invoiceResult.data;
          const sourceClient = (clientResult.data || []).find((client) => client.id === invoice.client_id) as unknown as Client | undefined;
          const activeContacts = sourceClient?.client_contacts?.filter((contact) => contact.is_active) || [];
          const billingEmails = activeContacts.filter((contact) => contact.contact_type === "billing").map((contact) => contact.email);
          const primaryEmail = activeContacts.find((contact) => contact.is_primary || contact.contact_type === "primary")?.email;
          const fallbackRecipients = billingEmails.length ? billingEmails.join(", ") : primaryEmail || "";
          setName(`Invoice #${invoice.invoice_number} recurring`); setClientId(invoice.client_id); setCurrency(invoice.currency); setTax(String(invoice.tax_amount || 0)); setDiscount(String(invoice.discount_amount || 0)); setNotes(invoice.notes || ""); setEmailTo(invoice.sent_to || fallbackRecipients); setEmailCc(invoice.sent_cc || "sales@despacho.io"); setSubject(invoice.email_subject || ""); setBody(invoice.email_body || "");
          const dayDifference = Math.max(0, Math.round((new Date(`${invoice.due_date}T00:00:00Z`).getTime() - new Date(`${invoice.issue_date}T00:00:00Z`).getTime()) / 86_400_000)); setTerms(String(dayDifference));
        }
        if (itemResult.data?.length) setItems(itemResult.data.map((item) => ({ project_id: item.project_id || "", description: item.description, hours: String(item.hours), quantity: String(item.quantity), unit_price: String(item.unit_price), amount: String(item.amount) })));
      }
      setLoading(false);
    }
    void load();
  }, [scheduleId, scheduledDate, sourceInvoiceId]);

  const filteredProjects = useMemo(() => projects.filter((project) => project.client_id === clientId), [clientId, projects]);
  const total = useMemo(() => items.reduce((sum, item) => sum + Number(item.amount || 0), 0) + Number(tax || 0) - Number(discount || 0), [discount, items, tax]);

  function updateItem(index: number, field: keyof Item, value: string) { setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item)); }
  function selectClient(value: string) {
    setClientId(value); setItems((current) => current.map((item) => ({ ...item, project_id: "" })));
    if (!emailTo) {
      const contacts = clients.find((client) => client.id === value)?.client_contacts?.filter((contact) => contact.is_active) || [];
      const billing = contacts.filter((contact) => contact.contact_type === "billing").map((contact) => contact.email);
      const primary = contacts.find((contact) => contact.is_primary || contact.contact_type === "primary")?.email;
      setEmailTo((billing.length ? billing : primary ? [primary] : []).join(", "));
    }
  }

  async function save() {
    setError("");
    if (!clientId || (!occurrenceMode && !name.trim()) || items.some((item) => !item.project_id || !item.description.trim())) { setError("Complete the required fields and every line item."); return; }
    if (autoSend && !emailTo.trim()) { setError("Email To is required when Auto-send is enabled."); return; }
    setSaving(true);
    const { data } = await supabase.auth.getSession(); const token = data.session?.access_token;
    if (!token) { setError("Your session has expired."); setSaving(false); return; }
    const payload = {
      name, client_id: clientId, frequency, interval_count: Number(intervalCount), start_date: startDate, end_date: endDate || null, next_generation_date: nextDate,
      issue_date: issueDate, due_date: dueDate, payment_terms_days: Number(terms), currency, tax_amount: Number(tax), discount_amount: Number(discount), notes: notes || null,
      email_to: emailTo || null, email_cc: emailCc || null, email_subject: subject || null, email_body: body || null, auto_send: autoSend, autopay_enabled: autopay,
      items: items.map((item) => ({ ...item, hours: Number(item.hours), quantity: Number(item.quantity), unit_price: Number(item.unit_price), amount: Number(item.amount) })),
    };
    const endpoint = occurrenceMode ? `/api/recurring-invoices/${scheduleId}/occurrences/${scheduledDate}` : editMode ? `/api/recurring-invoices/${scheduleId}` : "/api/recurring-invoices";
    const response = await fetch(endpoint, { method: occurrenceMode || editMode ? "PUT" : "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const result = await response.json().catch(() => null); setSaving(false);
    if (!response.ok) { setError(result?.error || "Unable to save recurring invoice."); return; }
    router.push("/dashboard/invoices/recurring"); router.refresh();
  }

  if (loading) return <div className="py-24 text-center text-slate-500">Loading recurring invoice…</div>;
  return (
    <KairoCard className="p-7 sm:p-8">
      {error ? <div role="alert" className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div> : null}
      {!occurrenceMode ? <section><h2 className="text-lg font-bold">Schedule</h2><div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-4"><KairoInput label="Schedule Name" value={name} onChange={(event) => setName(event.target.value)} /><KairoSelect label="Client" value={clientId} onChange={(event) => selectClient(event.target.value)}><option value="">Select client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</KairoSelect><KairoSelect label="Frequency" value={frequency} onChange={(event) => setFrequency(event.target.value)}><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="yearly">Yearly</option><option value="custom">Custom (days)</option></KairoSelect><KairoInput label="Interval Count" type="number" min="1" value={intervalCount} onChange={(event) => setIntervalCount(event.target.value)} /><KairoInput label="Start Date" type="date" value={startDate} onChange={(event) => { setStartDate(event.target.value); setNextDate(event.target.value); }} /><KairoInput label="End Date (optional)" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /><KairoInput label="Next Generation Date" type="date" value={nextDate} onChange={(event) => setNextDate(event.target.value)} /><KairoInput label="Payment Terms (days)" type="number" min="0" value={terms} onChange={(event) => setTerms(event.target.value)} /></div></section> : <section><h2 className="text-lg font-bold">Occurrence dates</h2><div className="mt-5 grid gap-5 md:grid-cols-2"><KairoInput label="Issue Date" type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} /><KairoInput label="Due Date" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></div></section>}

      <section className="mt-8 border-t border-slate-200 pt-8"><h2 className="text-lg font-bold">Financial details</h2><div className="mt-5 grid gap-5 md:grid-cols-3"><KairoSelect label="Currency" value={currency} onChange={(event) => setCurrency(event.target.value)}><option>USD</option><option>CAD</option><option>INR</option></KairoSelect><KairoInput label="Tax" type="number" step="0.01" value={tax} onChange={(event) => setTax(event.target.value)} /><KairoInput label="Discount" type="number" step="0.01" value={discount} onChange={(event) => setDiscount(event.target.value)} /></div><div className="mt-5"><KairoTextarea label="Notes" value={notes} onChange={(event) => setNotes(event.target.value)} /></div></section>

      <section className="mt-8 border-t border-slate-200 pt-8"><div className="flex items-center justify-between"><div><h2 className="text-lg font-bold">Line items</h2><p className="mt-1 text-sm text-slate-500">These values remain editable on every generated Draft.</p></div><KairoButton type="button" variant="secondary" onClick={() => setItems((current) => [...current, emptyItem()])}>+ Add item</KairoButton></div><div className="mt-5 space-y-4">{items.map((item, index) => <div key={index} className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:grid-cols-12"><div className="lg:col-span-3"><KairoSelect label="Project" value={item.project_id} onChange={(event) => updateItem(index, "project_id", event.target.value)}><option value="">Select project</option>{filteredProjects.map((project) => <option key={project.id} value={project.id}>[{project.project_code || "—"}] {project.name}</option>)}</KairoSelect></div><div className="lg:col-span-3"><KairoInput label="Description" value={item.description} onChange={(event) => updateItem(index, "description", event.target.value)} /></div><div className="lg:col-span-1"><KairoInput label="Hours" type="number" step=".01" value={item.hours} onChange={(event) => updateItem(index, "hours", event.target.value)} /></div><div className="lg:col-span-1"><KairoInput label="Qty" type="number" step=".01" value={item.quantity} onChange={(event) => updateItem(index, "quantity", event.target.value)} /></div><div className="lg:col-span-2"><KairoInput label="Unit Price" type="number" step=".01" value={item.unit_price} onChange={(event) => updateItem(index, "unit_price", event.target.value)} /></div><div className="lg:col-span-2"><KairoInput label="Amount" type="number" step=".01" value={item.amount} onChange={(event) => updateItem(index, "amount", event.target.value)} /></div>{items.length > 1 ? <button type="button" onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="text-left text-xs font-bold text-red-600 lg:col-span-12">Remove item</button> : null}</div>)}</div></section>

      <section className="mt-8 border-t border-slate-200 pt-8"><h2 className="text-lg font-bold">Email defaults</h2><p className="mt-1 text-sm text-slate-500">Recipients are stored with this schedule and will not change when client contacts change.</p><div className="mt-5 grid gap-5 md:grid-cols-2"><KairoInput label="Email To" value={emailTo} onChange={(event) => setEmailTo(event.target.value)} placeholder="billing@client.com" /><KairoInput label="Email CC" value={emailCc} onChange={(event) => setEmailCc(event.target.value)} /><KairoInput label="Subject" value={subject} onChange={(event) => setSubject(event.target.value)} className="md:col-span-2" /></div><div className="mt-5"><KairoTextarea label="Email Body" rows={6} value={body} onChange={(event) => setBody(event.target.value)} /></div>{!occurrenceMode ? <div className="mt-5 grid gap-4 md:grid-cols-2"><label className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4"><input type="checkbox" checked={autoSend} onChange={(event) => setAutoSend(event.target.checked)} className="mt-1" /><span><strong className="block text-sm">Auto-send after Draft generation</strong><span className="text-xs text-slate-500">Uses the stored recipients above.</span></span></label><label className="flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50/50 p-4"><input type="checkbox" checked={autopay} onChange={(event) => setAutopay(event.target.checked)} className="mt-1" /><span><strong className="block text-sm text-[#153E90]">Autopay Enabled</strong><span className="text-xs text-slate-500">Autopay integration coming soon. No charge will occur.</span></span></label></div> : null}</section>

      <div className="mt-8 flex flex-col items-end justify-between gap-4 border-t border-slate-200 pt-6 sm:flex-row"><div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Estimated total</p><p className="mt-1 text-2xl font-bold text-[#153E90]">{currency} {total.toFixed(2)}</p></div><div className="flex gap-3"><KairoButton type="button" variant="secondary" onClick={() => router.push("/dashboard/invoices/recurring")}>Cancel</KairoButton><KairoButton type="button" onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : occurrenceMode ? "Save Upcoming Invoice" : editMode ? "Save Schedule" : "Create Schedule"}</KairoButton></div></div>
    </KairoCard>
  );
}

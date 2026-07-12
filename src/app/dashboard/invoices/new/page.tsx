"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import KairoButton from "@/components/ui/KairoButton";
import KairoCard from "@/components/ui/KairoCard";
import KairoInput from "@/components/ui/KairoInput";
import KairoPageHeader from "@/components/ui/KairoPageHeader";
import KairoSelect from "@/components/ui/KairoSelect";
import KairoTextarea from "@/components/ui/KairoTextarea";

type Client = {
  id: string;
  name: string;
};

type Project = {
  id: string;
  name: string;
  project_code: string | null;
  client_id: string;
};

type LineItem = {
  project_id: string;
  description: string;
  hours: string;
  amount: string;
};

type InvoiceDefaults = {
  default_currency: string;
  default_payment_terms_days: number;
  default_tax_rate: number;
  default_invoice_notes: string | null;
  payment_instructions: string | null;
};

const emptyLineItem = (): LineItem => ({
  project_id: "",
  description: "",
  hours: "",
  amount: "",
});

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(dateValue: string, days: number) {
  const date = new Date(`${dateValue}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toDateInputValue(date);
}

export default function NewInvoicePage() {
  const router = useRouter();

  const today = useMemo(() => toDateInputValue(new Date()), []);

  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [clientId, setClientId] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [paymentTerms, setPaymentTerms] = useState("7");
  const [taxRate, setTaxRate] = useState("0");
  const [issueDate, setIssueDate] = useState(today);
  const [dueDate, setDueDate] = useState(addDays(today, 7));
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([emptyLineItem()]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);

    const [clientResult, projectResult, settingsResult] = await Promise.all([
      supabase
        .from("clients")
        .select("id,name")
        .eq("status", "active")
        .order("name"),
      supabase
        .from("projects")
        .select("id,name,project_code,client_id")
        .eq("status", "active")
        .order("name"),
      supabase
        .from("company_settings")
        .select(
          "default_currency,default_payment_terms_days,default_tax_rate,default_invoice_notes,payment_instructions",
        )
        .eq("singleton_key", true)
        .maybeSingle(),
    ]);

    if (clientResult.error) {
      console.error("Client load error:", clientResult.error);
    } else {
      setClients((clientResult.data || []) as Client[]);
    }

    if (projectResult.error) {
      console.error("Project load error:", projectResult.error);
    } else {
      setProjects((projectResult.data || []) as Project[]);
    }

    if (settingsResult.data) {
      const defaults = settingsResult.data as InvoiceDefaults;
      const terms = Math.max(
        0,
        Number(defaults.default_payment_terms_days || 0),
      );
      setCurrency(defaults.default_currency || "USD");
      setPaymentTerms(String(terms));
      setTaxRate(String(Number(defaults.default_tax_rate || 0)));
      setDueDate(addDays(today, terms));
      setNotes(
        [defaults.default_invoice_notes, defaults.payment_instructions]
          .filter(Boolean)
          .join("\n\n"),
      );
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const filteredProjects = useMemo(
    () => projects.filter((project) => project.client_id === clientId),
    [projects, clientId],
  );

  const totalHours = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.hours || 0), 0),
    [items],
  );

  const totalAmount = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [items],
  );

  const taxAmount = useMemo(
    () => totalAmount * (Math.max(0, Number(taxRate || 0)) / 100),
    [taxRate, totalAmount],
  );
  const grandTotal = totalAmount + taxAmount;

  function updateItem(index: number, field: keyof LineItem, value: string) {
    setItems((currentItems) =>
      currentItems.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    );
  }

  function addItem() {
    setItems((currentItems) => [...currentItems, emptyLineItem()]);
  }

  function removeItem(index: number) {
    setItems((currentItems) =>
      currentItems.filter((_, itemIndex) => itemIndex !== index),
    );
  }

  function handleClientChange(value: string) {
    setClientId(value);
    setItems((currentItems) =>
      currentItems.map((item) => ({ ...item, project_id: "" })),
    );
  }

  function handleIssueDateChange(value: string) {
    setIssueDate(value);
    setDueDate(addDays(value, Math.max(0, Number(paymentTerms || 0))));
  }

  async function saveDraft() {
    const hasIncompleteItem = items.some(
      (item) =>
        !item.project_id ||
        !item.description.trim() ||
        Number(item.hours || 0) <= 0 ||
        Number(item.amount || 0) < 0,
    );

    if (!clientId || !issueDate || !dueDate || hasIncompleteItem) {
      alert(
        "Please select a client and complete every line item with a project, description, valid hours, and amount.",
      );
      return;
    }

    if (saving) return;
    setSaving(true);

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .insert({
        client_id: clientId,
        issue_date: issueDate,
        due_date: dueDate,
        currency,
        subtotal: totalAmount,
        tax_amount: taxAmount,
        total_amount: grandTotal,
        hours_purchased: totalHours,
        status: "draft",
        notes: notes.trim() || null,
      })
      .select("id,invoice_number")
      .single();

    if (invoiceError || !invoice) {
      alert(invoiceError?.message || "Invoice could not be created.");
      setSaving(false);
      return;
    }

    const { error: itemError } = await supabase.from("invoice_items").insert(
      items.map((item) => ({
        invoice_id: invoice.id,
        project_id: item.project_id,
        description: item.description.trim(),
        hours: Number(item.hours),
        quantity: 1,
        unit_price: Number(item.amount),
        amount: Number(item.amount),
      })),
    );

    if (itemError) {
      console.error("Invoice item error:", itemError);

      const { error: cleanupError } = await supabase
        .from("invoices")
        .delete()
        .eq("id", invoice.id);

      if (cleanupError) {
        console.error("Invoice cleanup error:", cleanupError);
      }

      alert(itemError.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    alert(`Invoice #${invoice.invoice_number} created successfully.`);
    router.push(`/dashboard/invoices/${invoice.id}`);
  }

  return (
    <main className="min-h-screen bg-[#f8fafc] px-8 py-7">
      <div className="mx-auto max-w-6xl">
        <button
          type="button"
          onClick={() => router.push("/dashboard/invoices")}
          className="mb-6 text-sm font-semibold text-slate-500 transition hover:text-slate-950"
        >
          ← Back to Invoices
        </button>

        <KairoPageHeader
          title="New Invoice"
          subtitle="Prepare a prepaid service invoice for one or more projects."
          action={
            <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700">
              Draft
            </span>
          }
        />

        <KairoCard className="mt-8 p-8">
          <section>
            <h2 className="text-lg font-bold text-slate-950">
              Invoice Details
            </h2>

            <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-600">
                  Invoice #
                </label>
                <div className="flex min-h-12 items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500">
                  Assigned when saved
                </div>
              </div>

              <KairoSelect
                label="Client"
                value={clientId}
                onChange={(event) => handleClientChange(event.target.value)}
                disabled={loading}
              >
                <option value="">
                  {loading ? "Loading clients..." : "Select client"}
                </option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </KairoSelect>

              <KairoInput
                label="Issue Date"
                type="date"
                value={issueDate}
                onChange={(event) => handleIssueDateChange(event.target.value)}
              />

              <KairoInput
                label="Due Date"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </div>

            <div className="mt-5 max-w-48">
              <KairoSelect
                label="Currency"
                value={currency}
                onChange={(event) => setCurrency(event.target.value)}
              >
                <option value="USD">USD</option>
                <option value="CAD">CAD</option>
                <option value="INR">INR</option>
              </KairoSelect>
            </div>
            <div className="mt-5 grid max-w-xl gap-5 sm:grid-cols-2">
              <KairoInput
                label="Payment Terms (days)"
                type="number"
                min="0"
                value={paymentTerms}
                onChange={(event) => {
                  const terms = event.target.value;
                  setPaymentTerms(terms);
                  setDueDate(
                    addDays(issueDate, Math.max(0, Number(terms || 0))),
                  );
                }}
              />
              <KairoInput
                label="Tax Rate (%)"
                type="number"
                min="0"
                step="0.01"
                value={taxRate}
                onChange={(event) => setTaxRate(event.target.value)}
              />
            </div>
          </section>

          <section className="mt-10 border-t border-slate-200 pt-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Line Items</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Choose the project that should receive each hour credit after
                  payment.
                </p>
              </div>

              <KairoButton type="button" variant="secondary" onClick={addItem}>
                + Add Line Item
              </KairoButton>
            </div>

            <div className="mt-5 space-y-4">
              {items.map((item, index) => (
                <div
                  key={index}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
                >
                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
                    <div className="xl:col-span-3">
                      <KairoSelect
                        label="Project"
                        value={item.project_id}
                        onChange={(event) =>
                          updateItem(index, "project_id", event.target.value)
                        }
                        disabled={!clientId}
                      >
                        <option value="">
                          {clientId ? "Select project" : "Select client first"}
                        </option>
                        {filteredProjects.map((project) => (
                          <option key={project.id} value={project.id}>
                            [{project.project_code || "No Code"}] {project.name}
                          </option>
                        ))}
                      </KairoSelect>
                    </div>

                    <div className="xl:col-span-4">
                      <KairoInput
                        label="Description"
                        value={item.description}
                        onChange={(event) =>
                          updateItem(index, "description", event.target.value)
                        }
                        placeholder="Service description"
                      />
                    </div>

                    <div className="xl:col-span-2">
                      <KairoInput
                        label="Hours"
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.hours}
                        onChange={(event) =>
                          updateItem(index, "hours", event.target.value)
                        }
                        placeholder="0.00"
                      />
                    </div>

                    <div className="xl:col-span-3">
                      <KairoInput
                        label={`Amount (${currency})`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.amount}
                        onChange={(event) =>
                          updateItem(index, "amount", event.target.value)
                        }
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="mt-4 text-sm font-bold text-red-600 transition hover:text-red-700"
                    >
                      Remove line item
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="mt-8 border-t border-slate-200 pt-8">
            <KairoTextarea
              label="Notes / Payment Instructions"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Bank details or payment instructions"
              className="h-36 resize-y"
            />
          </section>

          <section className="mt-8 flex justify-end">
            <div className="w-full rounded-2xl bg-slate-950 p-6 text-white sm:w-96">
              <div className="flex items-center justify-between text-sm text-slate-300">
                <span>Total Hours</span>
                <span className="font-bold text-white">
                  {totalHours.toFixed(2)}
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between text-sm text-slate-300">
                <span>Subtotal</span>
                <span className="font-bold text-white">
                  {currency} {totalAmount.toFixed(2)}
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between text-sm text-slate-300">
                <span>Tax ({Number(taxRate || 0).toFixed(2)}%)</span>
                <span className="font-bold text-white">
                  {currency} {taxAmount.toFixed(2)}
                </span>
              </div>

              <div className="mt-4 flex items-end justify-between gap-4 border-t border-slate-700 pt-4">
                <span className="text-sm font-semibold text-slate-300">
                  Total
                </span>
                <span className="text-3xl font-bold tracking-tight">
                  {currency} {grandTotal.toFixed(2)}
                </span>
              </div>
            </div>
          </section>

          <div className="mt-8 flex justify-end gap-3 border-t border-slate-200 pt-6">
            <KairoButton
              type="button"
              variant="secondary"
              onClick={() => router.push("/dashboard/invoices")}
              disabled={saving}
            >
              Cancel
            </KairoButton>

            <KairoButton
              type="button"
              onClick={saveDraft}
              disabled={saving || loading}
              className="disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Draft"}
            </KairoButton>
          </div>
        </KairoCard>
      </div>
    </main>
  );
}

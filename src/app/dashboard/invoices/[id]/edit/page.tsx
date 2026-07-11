"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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

type Invoice = {
  id: string;
  invoice_number: number;
  client_id: string;
  issue_date: string;
  due_date: string;
  currency: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  hours_purchased: number;
  status: string;
  notes: string | null;
};

type InvoiceItem = {
  id: string;
  project_id: string;
  description: string;
  hours: number;
  quantity: number;
  unit_price: number;
  amount: number;
  projects: {
    id: string;
    name: string;
    project_code: string | null;
    client_id: string;
  }[] | null;
};

type LineItem = {
  project_id: string;
  description: string;
  hours: string;
  amount: string;
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

export default function EditInvoicePage() {
  const router = useRouter();
  const params = useParams();
  const invoiceId = params.id as string;

  const today = useMemo(() => toDateInputValue(new Date()), []);

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [clientId, setClientId] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [issueDate, setIssueDate] = useState(today);
  const [dueDate, setDueDate] = useState(addDays(today, 7));
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([emptyLineItem()]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [duplicateSuccess, setDuplicateSuccess] = useState("");

  async function loadMetaData() {
    const [clientResult, projectResult] = await Promise.all([
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
    ]);

    if (!clientResult.error) {
      setClients((clientResult.data || []) as Client[]);
    }

    if (!projectResult.error) {
      setProjects((projectResult.data || []) as Project[]);
    }
  }

  async function loadInvoice() {
    setLoading(true);
    setErrorMessage("");

    if (!invoiceId) {
      setErrorMessage("Invoice not found.");
      setLoading(false);
      return;
    }

    const { data: invoiceData, error: invoiceError } = await supabase
      .from("invoices")
      .select(`
        id,
        invoice_number,
        client_id,
        issue_date,
        due_date,
        currency,
        subtotal,
        tax_amount,
        total_amount,
        hours_purchased,
        status,
        notes
      `)
      .eq("id", invoiceId)
      .single();

    if (invoiceError || !invoiceData) {
      console.error("Invoice load error:", invoiceError);
      setErrorMessage("Invoice not found.");
      setLoading(false);
      return;
    }

    const invoiceRecord = invoiceData as Invoice;
    setInvoice(invoiceRecord);
    setClientId(invoiceRecord.client_id);
    setCurrency(invoiceRecord.currency || "USD");
    setIssueDate(invoiceRecord.issue_date || today);
    setDueDate(invoiceRecord.due_date || addDays(today, 7));
    setNotes(invoiceRecord.notes || "");

    const { data: itemData, error: itemError } = await supabase
      .from("invoice_items")
      .select(`
        id,
        project_id,
        description,
        hours,
        quantity,
        unit_price,
        amount,
        projects(
          id,
          name,
          project_code,
          client_id
        )
      `)
      .eq("invoice_id", invoiceId);

    if (itemError) {
      console.error("Invoice item load error:", itemError);
      setItems([emptyLineItem()]);
    } else {
      const loadedItems = (itemData || []) as InvoiceItem[];
      if (loadedItems.length > 0) {
        setItems(
          loadedItems.map((item) => ({
            project_id: item.project_id,
            description: item.description,
            hours: String(item.hours ?? ""),
            amount: String(item.amount ?? ""),
          }))
        );
      } else {
        setItems([emptyLineItem()]);
      }
    }

    setLoading(false);
  }

  useEffect(() => {
    const duplicateMessage = window.sessionStorage.getItem("invoiceDuplicateSuccess");
    if (duplicateMessage) {
      setDuplicateSuccess(duplicateMessage);
      window.sessionStorage.removeItem("invoiceDuplicateSuccess");
    }
    loadMetaData();
    loadInvoice();
  }, [invoiceId]);

  const filteredProjects = useMemo(
    () => projects.filter((project) => project.client_id === clientId),
    [projects, clientId]
  );

  const totalHours = useMemo(
    () =>
      items.reduce((sum, item) => sum + Number(item.hours || 0), 0),
    [items]
  );

  const totalAmount = useMemo(
    () =>
      items.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [items]
  );

  function updateItem(index: number, field: keyof LineItem, value: string) {
    setItems((currentItems) =>
      currentItems.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      )
    );
  }

  function addItem() {
    setItems((currentItems) => [...currentItems, emptyLineItem()]);
  }

  function removeItem(index: number) {
    setItems((currentItems) =>
      currentItems.filter((_, itemIndex) => itemIndex !== index)
    );
  }

  function handleClientChange(value: string) {
    setClientId(value);
    setItems((currentItems) =>
      currentItems.map((item) => ({ ...item, project_id: "" }))
    );
  }

  function handleIssueDateChange(value: string) {
    setIssueDate(value);
    setDueDate(addDays(value, 7));
  }

  async function saveDraft() {
    if (!invoice) return;
    if (invoice.status !== "draft") {
      alert("Only draft invoices can be edited.");
      return;
    }

    const hasIncompleteItem = items.some(
      (item) =>
        !item.project_id ||
        !item.description.trim() ||
        Number(item.hours || 0) <= 0 ||
        Number(item.amount || 0) < 0
    );

    if (!clientId || !issueDate || !dueDate || hasIncompleteItem) {
      alert(
        "Please select a client and complete every line item with a project, description, valid hours, and amount."
      );
      return;
    }

    if (saving) return;
    setSaving(true);

    const { data: updatedInvoice, error: invoiceError } = await supabase
      .from("invoices")
      .update({
        client_id: clientId,
        issue_date: issueDate,
        due_date: dueDate,
        currency,
        subtotal: totalAmount,
        tax_amount: 0,
        total_amount: totalAmount,
        hours_purchased: totalHours,
        notes: notes.trim() || null,
      })
      .eq("id", invoiceId)
      .eq("status", "draft")
      .select("id,invoice_number")
      .single();

    if (invoiceError || !updatedInvoice) {
      console.error("Invoice update error:", invoiceError);
      alert(invoiceError?.message || "Unable to update invoice.");
      setSaving(false);
      return;
    }

    const previousItems = [...items];

    const { error: deleteError } = await supabase
      .from("invoice_items")
      .delete()
      .eq("invoice_id", invoiceId);

    if (deleteError) {
      console.error("Invoice items delete error:", deleteError);
      alert(deleteError.message || "Unable to update invoice items.");
      setSaving(false);
      return;
    }

    const { error: itemError } = await supabase.from("invoice_items").insert(
      items.map((item) => ({
        invoice_id: invoiceId,
        project_id: item.project_id,
        description: item.description.trim(),
        hours: Number(item.hours),
        quantity: 1,
        unit_price: Number(item.amount),
        amount: Number(item.amount),
      }))
    );

    if (itemError) {
      console.error("Invoice items insert error:", itemError);
      const rollbackResult = await supabase.from("invoice_items").insert(
        previousItems.map((item) => ({
          invoice_id: invoiceId,
          project_id: item.project_id,
          description: item.description.trim(),
          hours: Number(item.hours),
          quantity: 1,
          unit_price: Number(item.amount),
          amount: Number(item.amount),
        }))
      );

      if (rollbackResult.error) {
        console.error("Invoice items rollback error:", rollbackResult.error);
      }

      alert(itemError.message || "Unable to update invoice items.");
      setSaving(false);
      return;
    }

    setSaving(false);
    router.push(`/dashboard/invoices/${invoiceId}`);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        Loading invoice...
      </main>
    );
  }

  if (!invoice) {
    return (
      <main className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        Invoice not found.
      </main>
    );
  }

  if (invoice.status !== "draft") {
    return (
      <main className="min-h-screen bg-[#f8fafc] px-8 py-7">
        <div className="mx-auto max-w-3xl">
          <KairoCard className="p-8 text-center">
            <h1 className="text-2xl font-bold text-slate-950">
              Invoice not editable
            </h1>
            <p className="mt-4 text-slate-500">
              Only draft invoices can be edited.
            </p>
            <div className="mt-6 flex justify-center">
              <KairoButton
                type="button"
                onClick={() => router.push(`/dashboard/invoices/${invoiceId}`)}
              >
                View Invoice
              </KairoButton>
            </div>
          </KairoCard>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f8fafc] px-8 py-7">
      <div className="mx-auto max-w-6xl">
        <button
          type="button"
          onClick={() => router.push(`/dashboard/invoices/${invoiceId}`)}
          className="mb-6 text-sm font-semibold text-slate-500 transition hover:text-slate-950"
        >
          ← Back to invoice
        </button>

        <KairoPageHeader
          title="Edit Draft Invoice"
          subtitle="Update the draft invoice before sending it to the client."
          action={
            <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700">
              Draft
            </span>
          }
        />

        {duplicateSuccess ? (
          <div role="status" className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-800 shadow-sm">
            {duplicateSuccess}
          </div>
        ) : null}

        <KairoCard className="mt-8 p-8">
          <section>
            <h2 className="text-lg font-bold text-slate-950">Invoice Details</h2>

            <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-600">
                  Invoice #
                </label>
                <div className="flex min-h-12 items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900">
                  #{invoice.invoice_number}
                </div>
              </div>

              <KairoSelect
                label="Client"
                value={clientId}
                onChange={(event) => handleClientChange(event.target.value)}
                disabled={loading}
              >
                <option value="">{loading ? "Loading clients..." : "Select client"}</option>
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
          </section>

          <section className="mt-10 border-t border-slate-200 pt-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Line Items</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Choose the project that should receive each hour credit after payment.
                </p>
              </div>

              <KairoButton type="button" variant="secondary" onClick={addItem}>
                + Add Line Item
              </KairoButton>
            </div>

            <div className="mt-5 space-y-4">
              {items.map((item, index) => (
                <div key={index} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
                    <div className="xl:col-span-3">
                      <KairoSelect
                        label="Project"
                        value={item.project_id}
                        onChange={(event) => updateItem(index, "project_id", event.target.value)}
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
                        onChange={(event) => updateItem(index, "description", event.target.value)}
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
                        onChange={(event) => updateItem(index, "hours", event.target.value)}
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
                        onChange={(event) => updateItem(index, "amount", event.target.value)}
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
                <span className="font-bold text-white">{totalHours.toFixed(2)}</span>
              </div>

              <div className="mt-4 flex items-end justify-between gap-4 border-t border-slate-700 pt-4">
                <span className="text-sm font-semibold text-slate-300">Total</span>
                <span className="text-3xl font-bold tracking-tight">
                  {currency} {totalAmount.toFixed(2)}
                </span>
              </div>
            </div>
          </section>

          <div className="mt-8 flex justify-end gap-3 border-t border-slate-200 pt-6">
            <KairoButton
              type="button"
              variant="secondary"
              onClick={() => router.push(`/dashboard/invoices/${invoiceId}`)}
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

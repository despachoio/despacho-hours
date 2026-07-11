"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

import InvoiceHeader from "./components/InvoiceHeader";
import InvoiceInfoCard from "./components/InvoiceInfoCard";
import InvoiceItems from "./components/InvoiceItems";
import InvoiceSummary from "./components/InvoiceSummary";
import PaymentCard from "./components/PaymentCard";
import InvoiceNotes from "./components/InvoiceNotes";
import InvoiceActions from "./components/InvoiceActions";
import InvoiceTimeline from "./components/InvoiceTimeline";

export type Invoice = {
  id: string;
  invoice_number: number;
  created_at: string;

  issue_date: string;
  due_date: string;

  currency: string;

  subtotal: number;
  tax_amount: number;
  total_amount: number;

  hours_purchased: number;

  status: string;

  sent_at: string | null;
  sent_to: string | null;
  email_subject: string | null;
  email_body: string | null;
  gmail_message_id: string | null;

  paid_at: string | null;
  paid_amount: number | null;
  payment_method: string | null;
  payment_reference: string | null;
  payment_reversed_at: string | null;
  payment_reversal_reason: string | null;

  voided_at?: string | null;
  void_reason?: string | null;

  notes: string | null;

  clients: {
    id: string;
    name: string;
    client_contacts?: {
      name: string;
      email: string;
      contact_type: string | null;
      is_primary: boolean;
      is_active: boolean;
    }[];
  } | null;
};

export type InvoicePayment = {
  id: string;
  amount: number;
  currency: string;
  payment_date: string;
  payment_method: string;
  reference_number: string | null;
  created_at: string;
  status: "completed" | "reversed";
  reversed_at: string | null;
  reversal_reason: string | null;
  reversal_notes: string | null;
};

export type InvoiceWalletCredit = {
  id: string;
  project_id: string;
  hours_delta: number;
  created_at: string;
  transaction_type: "invoice_credit" | "invoice_credit_reversal";
  payment_id: string | null;
  original_transaction_id: string | null;
};

export type InvoiceItem = {
  id: string;

  description: string;

  hours: number;

  quantity: number;

  unit_price: number;

  amount: number;

  projects: {
    id: string;
    name: string;
    project_code: string | null;
  } | null;
};

export default function InvoiceDetailPage() {
  const { id } = useParams();

  const [invoice, setInvoice] = useState<Invoice | null>(null);

  const [items, setItems] = useState<InvoiceItem[]>([]);

  const [payments, setPayments] = useState<InvoicePayment[]>([]);

  const [walletCredits, setWalletCredits] = useState<InvoiceWalletCredit[]>([]);

  const [loading, setLoading] = useState(true);

  const [isAdmin, setIsAdmin] = useState(false);

  async function loadActivityData() {
    const [paymentsResult, walletCreditsResult] = await Promise.all([
      supabase
        .from("payments")
        .select(`
          id,
          amount,
          currency,
          payment_date,
          payment_method,
          reference_number,
          created_at,
          status,
          reversed_at,
          reversal_reason,
          reversal_notes
        `)
        .eq("invoice_id", id)
        .order("created_at", { ascending: true }),
      supabase
        .from("project_hour_transactions")
        .select(`
          id,
          project_id,
          hours_delta,
          created_at,
          transaction_type,
          payment_id,
          original_transaction_id
        `)
        .eq("invoice_id", id)
        .in("transaction_type", ["invoice_credit", "invoice_credit_reversal"])
        .order("created_at", { ascending: true }),
    ]);

    if (paymentsResult.error) {
      console.error("Invoice payment activity load failed:", paymentsResult.error);
      setPayments([]);
    } else {
      setPayments(
        (paymentsResult.data || []).map((payment) => ({
          ...payment,
          amount: Number(payment.amount || 0),
        })) as InvoicePayment[]
      );
    }

    if (walletCreditsResult.error) {
      console.error(
        "Invoice wallet-credit activity load failed:",
        walletCreditsResult.error
      );
      setWalletCredits([]);
    } else {
      setWalletCredits(
        (walletCreditsResult.data || []).map((credit) => ({
          ...credit,
          hours_delta: Number(credit.hours_delta || 0),
        })) as InvoiceWalletCredit[]
      );
    }
  }

  async function loadInvoice() {
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", userData.user.id)
        .single();
      setIsAdmin(
        String(profileData?.role || "").trim().toLowerCase() === "admin"
      );
    }

    const { data: invoiceData, error } = await supabase
      .from("invoices")
      .select(`
        *,
        clients(
          id,
          name,
          client_contacts(
            name,
            email,
            contact_type,
            is_primary,
            is_active
          )
        )
      `)
      .eq("id", id)
      .single();

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    setInvoice(invoiceData as Invoice);

    const { data: itemData } = await supabase
      .from("invoice_items")
      .select(`
        *,
        projects(
          id,
          name,
          project_code
        )
      `)
      .eq("invoice_id", id);

    setItems((itemData || []) as InvoiceItem[]);

    await loadActivityData();

    setLoading(false);
  }

  useEffect(() => {
    // Initial client-side data load for this existing dashboard page.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadInvoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleInvoiceSent(update: Partial<Invoice>) {
    setInvoice((currentInvoice) =>
      currentInvoice ? { ...currentInvoice, ...update } : currentInvoice
    );
    void loadActivityData();
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

  return (
    <main className="min-h-screen bg-[#f8fafc] px-8 py-7">

      <div className="mx-auto max-w-7xl">

        <InvoiceHeader invoice={invoice} />

        <div className="mt-8 grid grid-cols-12 gap-6">

          {/* LEFT */}

          <div className="col-span-3 space-y-6">

            <InvoiceInfoCard invoice={invoice} />

            <PaymentCard invoice={invoice} payments={payments} />

          </div>

          {/* CENTER */}

          <div className="col-span-6 space-y-6">

            <InvoiceItems items={items} />

            <InvoiceSummary
              invoice={invoice}
            />

            <InvoiceNotes
              notes={invoice.notes}
            />

          </div>

          {/* RIGHT */}

          <div className="col-span-3 space-y-6">

            <InvoiceActions
              invoice={invoice}
              isAdmin={isAdmin}
              onInvoiceSent={handleInvoiceSent}
            />

            <InvoiceTimeline
              invoice={invoice}
              payments={payments}
              walletCredits={walletCredits}
            />

          </div>

        </div>

      </div>

    </main>
  );
}

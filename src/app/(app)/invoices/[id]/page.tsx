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
  invoice_number: number | null;
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
  generated_from_recurring: boolean;
  recurring_schedule_id: string | null;
  recurring_occurrence_id: string | null;
  recurring_invoice_schedules: { autopay_enabled: boolean } | null;
  draft_email_to: string | null;
  draft_email_cc: string | null;
  draft_email_subject: string | null;
  draft_email_body: string | null;
  sent_cc: string | null;

  reminders_enabled: boolean;
  reminders_stopped_at: string | null;
  reminders_stopped_by: string | null;
  reminders_stop_reason: string | null;
  last_reminder_sent_at: string | null;
  next_reminder_at: string | null;
  reminder_count: number;

  paid_at: string | null;
  paid_amount: number | null;
  payment_method: string | null;
  payment_reference: string | null;
  payment_reversed_at: string | null;
  payment_reversal_reason: string | null;
  public_payment_token: string;
  stripe_payment_intent_id: string | null;
  stripe_checkout_status: string | null;
  payment_failure_message: string | null;

  voided_at?: string | null;
  voided_by?: string | null;
  void_reason?: string | null;
  void_notes?: string | null;

  notes: string | null;

  clients: {
    id: string;
    name: string;
    autopay_enabled?: boolean;
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

export type InvoiceReminder = {
  id: string;
  sent_to: string;
  reminder_number: number;
  sent_at: string;
  status: "sent" | "failed" | "skipped";
  error_message: string | null;
};

export type InvoiceActivity = {
  id: string;
  event_type: string;
  description: string;
  created_at: string;
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
  const [reminders, setReminders] = useState<InvoiceReminder[]>([]);
  const [activities, setActivities] = useState<InvoiceActivity[]>([]);

  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  async function loadActivityData() {
    const [
      paymentsResult,
      walletCreditsResult,
      remindersResult,
      activitiesResult,
    ] = await Promise.all([
      supabase
        .from("payments")
        .select(
          `
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
        `,
        )
        .eq("invoice_id", id)
        .order("created_at", { ascending: true }),
      supabase
        .from("project_hour_transactions")
        .select(
          `
          id,
          project_id,
          hours_delta,
          created_at,
          transaction_type,
          payment_id,
          original_transaction_id
        `,
        )
        .eq("invoice_id", id)
        .in("transaction_type", ["invoice_credit", "invoice_credit_reversal"])
        .order("created_at", { ascending: true }),
      supabase
        .from("invoice_reminders")
        .select("id,sent_to,reminder_number,sent_at,status,error_message")
        .eq("invoice_id", id)
        .order("created_at", { ascending: true }),
      supabase
        .from("invoice_activities")
        .select("id,event_type,description,created_at")
        .eq("invoice_id", id)
        .in("event_type", [
          "reminders_stopped",
          "reminders_resumed",
          "stripe_payment_processing",
          "stripe_payment_failed",
          "stripe_payment_succeeded",
          "stripe_payment_canceled",
          "payment_page_viewed",
          "autopay_enabled",
          "autopay_disabled",
          "autopay_attempted",
          "autopay_action_required",
        ])
        .order("created_at", { ascending: true }),
    ]);

    if (paymentsResult.error) {
      console.error(
        "Invoice payment activity load failed:",
        paymentsResult.error,
      );
      setPayments([]);
    } else {
      setPayments(
        (paymentsResult.data || []).map((payment) => ({
          ...payment,
          amount: Number(payment.amount || 0),
        })) as InvoicePayment[],
      );
    }

    if (walletCreditsResult.error) {
      console.error(
        "Invoice wallet-credit activity load failed:",
        walletCreditsResult.error,
      );
      setWalletCredits([]);
    } else {
      setWalletCredits(
        (walletCreditsResult.data || []).map((credit) => ({
          ...credit,
          hours_delta: Number(credit.hours_delta || 0),
        })) as InvoiceWalletCredit[],
      );
    }

    setReminders(
      remindersResult.error
        ? []
        : ((remindersResult.data || []) as InvoiceReminder[]),
    );
    setActivities(
      activitiesResult.error
        ? []
        : ((activitiesResult.data || []) as InvoiceActivity[]),
    );
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
        String(profileData?.role || "")
          .trim()
          .toLowerCase() === "super admin",
      );
    }

    const invoiceDetailSelect = `
      *,
      clients(
        id,
        name,
        autopay_enabled,
        client_contacts(
          name,
          email,
          contact_type,
          is_primary,
          is_active
        )
      )
    `;
    const { data: invoiceData, error } = await supabase
      .from("invoices")
      .select(invoiceDetailSelect)
      .eq("id", id)
      .single();

    if (error) {
      console.error("Invoice detail load failed:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        invoiceId: id,
      });
      setLoading(false);
      return;
    }

    let resolvedInvoiceData = invoiceData;
    const normalizedInvoiceStatus = String(invoiceData.status || "")
      .trim()
      .toLowerCase();
    if (
      invoiceData.public_payment_token &&
      invoiceData.stripe_payment_intent_id &&
      !["paid", "void", "cancelled"].includes(normalizedInvoiceStatus)
    ) {
      const paymentStatusResponse = await fetch(
        `/api/public/invoices/${invoiceData.public_payment_token}/payment-status`,
        { cache: "no-store" },
      );
      const paymentStatusResult = (await paymentStatusResponse
        .json()
        .catch(() => ({}))) as { status?: string };

      if (paymentStatusResult.status === "paid") {
        const refreshedInvoice = await supabase
          .from("invoices")
          .select(invoiceDetailSelect)
          .eq("id", id)
          .single();
        if (refreshedInvoice.error) {
          console.error("Reconciled invoice reload failed:", {
            message: refreshedInvoice.error.message,
            invoiceId: id,
          });
        } else {
          resolvedInvoiceData = refreshedInvoice.data;
        }
      } else if (
        paymentStatusResult.status === "succeeded" ||
        !paymentStatusResponse.ok
      ) {
        console.error("Stripe invoice reconciliation is still pending:", {
          invoiceId: id,
          paymentStatus: paymentStatusResult.status || "unavailable",
        });
      }
    }

    let recurringSchedule: Invoice["recurring_invoice_schedules"] = null;
    if (resolvedInvoiceData.recurring_schedule_id) {
      const { data: scheduleData, error: scheduleError } = await supabase
        .from("recurring_invoice_schedules")
        .select("autopay_enabled")
        .eq("id", resolvedInvoiceData.recurring_schedule_id)
        .maybeSingle();

      if (scheduleError) {
        console.error("Recurring schedule detail load failed:", {
          message: scheduleError.message,
          details: scheduleError.details,
          hint: scheduleError.hint,
          code: scheduleError.code,
          scheduleId: resolvedInvoiceData.recurring_schedule_id,
        });
      } else if (scheduleData) {
        recurringSchedule = scheduleData;
      }
    }

    setInvoice({
      ...resolvedInvoiceData,
      recurring_invoice_schedules: recurringSchedule,
    } as Invoice);

    const { data: itemData } = await supabase
      .from("invoice_items")
      .select(
        `
        *,
        projects(
          id,
          name,
          project_code
        )
      `,
      )
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
      currentInvoice ? { ...currentInvoice, ...update } : currentInvoice,
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

            <PaymentCard invoice={invoice} payments={payments} isAdmin={isAdmin} />
          </div>

          {/* CENTER */}

          <div className="col-span-6 space-y-6">
            <InvoiceItems items={items} />

            <InvoiceSummary invoice={invoice} />

            <InvoiceNotes notes={invoice.notes} />
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
              reminders={reminders}
              activities={activities}
            />
          </div>
        </div>
      </div>
    </main>
  );
}

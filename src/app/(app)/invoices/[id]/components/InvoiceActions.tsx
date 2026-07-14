"use client";

import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import type { Invoice } from "../page";
import { supabase } from "@/lib/supabase";
import { DEFAULT_COMPANY_SETTINGS } from "@/lib/settings/companySettingsDefaults";

type Props = {
  invoice: Invoice;
  isAdmin: boolean;
  onInvoiceSent: (update: Partial<Invoice>) => void;
};

type Toast = {
  tone: "success" | "error";
  message: string;
} | null;

type RepairState = {
  gmailMessageId: string;
  recipient: string;
  cc: string[];
  subject: string;
  message: string;
  databaseError: string | null;
};

function uniqueEmails(emails: string[]) {
  return Array.from(
    new Map(
      emails
        .map((email) => email.trim())
        .filter(Boolean)
        .map((email) => [email.toLowerCase(), email]),
    ).values(),
  );
}

type RecipientFieldProps = {
  label: string;
  emails: string[];
  input: string;
  placeholder: string;
  autoFocus?: boolean;
  onInputChange: (value: string) => void;
  onAdd: () => void;
  onRemove: (email: string) => void;
};

function RecipientField({
  label,
  emails,
  input,
  placeholder,
  autoFocus,
  onInputChange,
  onAdd,
  onRemove,
}: RecipientFieldProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      onAdd();
    }
  }

  return (
    <div>
      <label
        className="text-sm font-semibold text-slate-700"
        htmlFor={`${label}-email`}
      >
        {label}
      </label>
      <div className="mt-2 flex min-h-12 flex-wrap items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 transition focus-within:border-[#153E90] focus-within:ring-4 focus-within:ring-blue-100">
        {emails.map((email) => (
          <span
            key={email.toLowerCase()}
            className="inline-flex max-w-full items-center gap-2 rounded-full bg-blue-50 py-1.5 pl-3 pr-1.5 text-sm font-semibold text-[#153E90] ring-1 ring-blue-200"
          >
            <span className="truncate">{email}</span>
            <button
              type="button"
              onClick={() => onRemove(email)}
              aria-label={`Remove ${email}`}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-base leading-none text-blue-500 transition hover:bg-blue-200 hover:text-blue-900"
            >
              ×
            </button>
          </span>
        ))}
        <input
          id={`${label}-email`}
          type="email"
          autoFocus={autoFocus}
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={onAdd}
          placeholder={emails.length ? "Add another email" : placeholder}
          className="min-w-44 flex-1 border-0 bg-transparent px-1 py-1 text-sm text-slate-950 outline-none"
        />
      </div>
      <p className="mt-1.5 text-xs text-slate-400">
        Press Enter or comma to add an address.
      </p>
    </div>
  );
}

function formatDueDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function todayForInput() {
  const today = new Date();
  const offset = today.getTimezoneOffset() * 60_000;
  return new Date(today.getTime() - offset).toISOString().slice(0, 10);
}

function addDays(dateValue: string, days: number) {
  const date = new Date(`${dateValue}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function invoicePaymentTerms(issueDate: string, dueDate: string) {
  const milliseconds =
    new Date(`${dueDate}T00:00:00Z`).getTime() -
    new Date(`${issueDate}T00:00:00Z`).getTime();
  return Math.max(0, Math.round(milliseconds / 86_400_000));
}

function defaultMessage(
  clientName: string,
  invoiceNumber: number,
  currency: string,
  totalAmount: number,
  dueDate: string,
  companyName: string,
) {
  const formattedAmount = Number(totalAmount || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return `Hi ${clientName},

Please find attached Invoice #${invoiceNumber} for ${currency} ${formattedAmount}.

The payment due date is ${formatDueDate(dueDate)}.

Thank you.

Regards,
${companyName}`;
}

const REVERSAL_REASONS = [
  "Payment recorded by mistake",
  "Payment failed or was reversed by bank",
  "Payment applied to wrong invoice",
  "Duplicate payment entry",
  "Refund issued",
  "Other",
];

const VOID_REASONS = [
  "Sent by mistake",
  "Duplicate invoice",
  "Client requested cancellation",
  "Replaced by another invoice",
  "Incorrect amount or hours",
  "Other",
];

export default function InvoiceActions({
  invoice,
  isAdmin,
  onInvoiceSent,
}: Props) {
  const router = useRouter();
  const contacts = useMemo(
    () => invoice.clients?.client_contacts || [],
    [invoice.clients],
  );
  const billingContacts = contacts.filter(
    (contact) =>
      contact.email &&
      contact.is_active !== false &&
      contact.contact_type?.trim().toLowerCase() === "billing",
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [to, setTo] = useState<string[]>([]);
  const [cc, setCc] = useState<string[]>([]);
  const [toInput, setToInput] = useState("");
  const [ccInput, setCcInput] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [repairState, setRepairState] = useState<RepairState | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);
  const [paymentDate, setPaymentDate] = useState(todayForInput());
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [duplicateIssueDate, setDuplicateIssueDate] = useState(todayForInput());
  const [duplicateTerms, setDuplicateTerms] = useState(0);
  const [duplicateDueDate, setDuplicateDueDate] = useState(todayForInput());
  const [duplicateError, setDuplicateError] = useState("");
  const duplicateRequestInFlight = useRef(false);
  const [isReversalModalOpen, setIsReversalModalOpen] = useState(false);
  const [isReversingPayment, setIsReversingPayment] = useState(false);
  const [reversalReason, setReversalReason] = useState("");
  const [customReversalReason, setCustomReversalReason] = useState("");
  const [reversalNotes, setReversalNotes] = useState("");
  const [reversalError, setReversalError] = useState("");
  const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);
  const [isVoiding, setIsVoiding] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [customVoidReason, setCustomVoidReason] = useState("");
  const [voidNotes, setVoidNotes] = useState("");
  const [voidError, setVoidError] = useState("");
  const voidRequestInFlight = useRef(false);
  const [isStopRemindersModalOpen, setIsStopRemindersModalOpen] =
    useState(false);
  const [isUpdatingReminders, setIsUpdatingReminders] = useState(false);
  const [reminderStopReason, setReminderStopReason] = useState("");
  const [reminderError, setReminderError] = useState("");
  const [isDeleteDraftModalOpen, setIsDeleteDraftModalOpen] = useState(false);
  const [isDeletingDraft, setIsDeletingDraft] = useState(false);
  const [deleteDraftError, setDeleteDraftError] = useState("");
  const [companyIdentity, setCompanyIdentity] = useState({
    companyName: DEFAULT_COMPANY_SETTINGS.company_name,
    businessEmail: DEFAULT_COMPANY_SETTINGS.business_email || "",
  });
  const normalizedStatus = invoice.status.trim().toLowerCase();
  const recurringSchedule = Array.isArray(invoice.recurring_invoice_schedules)
    ? invoice.recurring_invoice_schedules[0]
    : invoice.recurring_invoice_schedules;
  const canDeleteDraft =
    isAdmin &&
    normalizedStatus === "draft" &&
    (invoice.generated_from_recurring !== true ||
      recurringSchedule?.autopay_enabled !== true);
  const canSendInvoice = !["paid", "void", "cancelled"].includes(
    normalizedStatus,
  );
  const canRecordPayment = ["sent", "overdue"].includes(normalizedStatus);

  useEffect(() => {
    void supabase
      .from("company_settings")
      .select("company_name,business_email")
      .eq("singleton_key", true)
      .maybeSingle()
      .then(({ data }) => {
        if (data)
          setCompanyIdentity({
            companyName:
              data.company_name || DEFAULT_COMPANY_SETTINGS.company_name,
            businessEmail:
              data.business_email ||
              DEFAULT_COMPANY_SETTINGS.business_email ||
              "",
          });
      });
  }, []);

  function showToast(nextToast: Exclude<Toast, null>) {
    setToast(nextToast);
    window.setTimeout(() => setToast(null), 4500);
  }

  function openSendModal() {
    const billingEmails = billingContacts.map((contact) => contact.email);
    const primaryEmail = contacts.find(
      (contact) =>
        contact.email &&
        contact.is_active !== false &&
        (contact.is_primary ||
          contact.contact_type?.trim().toLowerCase() === "primary"),
    )?.email;

    const storedDraftTo = invoice.draft_email_to?.split(",") || [];
    const storedDraftCc = invoice.draft_email_cc?.split(",") || [];
    setTo(
      uniqueEmails(
        storedDraftTo.length && storedDraftTo.some((email) => email.trim())
          ? storedDraftTo
          : billingEmails.length
            ? billingEmails
            : [primaryEmail || ""],
      ),
    );
    setCc(
      uniqueEmails(
        storedDraftCc.length && storedDraftCc.some((email) => email.trim())
          ? storedDraftCc
          : [companyIdentity.businessEmail],
      ),
    );
    setToInput("");
    setCcInput("");
    setSubject(
      invoice.email_subject ||
        invoice.draft_email_subject ||
        `Invoice #${invoice.invoice_number} from ${companyIdentity.companyName}`,
    );
    setMessage(
      invoice.email_body ||
        invoice.draft_email_body ||
        defaultMessage(
          invoice.clients?.name || "Client",
          invoice.invoice_number,
          invoice.currency,
          invoice.total_amount,
          invoice.due_date,
          companyIdentity.companyName,
        ),
    );
    setIdempotencyKey(crypto.randomUUID());
    setIsModalOpen(true);
  }

  async function getAccessToken() {
    const { data: sessionData } = await supabase.auth.getSession();
    return sessionData.session?.access_token || null;
  }

  async function downloadPdf() {
    if (isDownloading) return;
    setIsDownloading(true);

    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        showToast({
          tone: "error",
          message: "Your session has expired. Please log in again.",
        });
        window.setTimeout(() => router.push("/login"), 1000);
        return;
      }

      const response = await fetch(`/api/invoices/${invoice.id}/pdf`, {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });

      if (!response.ok) {
        let errorMessage = "Unable to download the invoice PDF.";
        try {
          const errorData = await response.json();
          errorMessage = errorData?.error || errorMessage;
        } catch {
          // Preserve the fallback for non-JSON responses.
        }
        throw new Error(errorMessage);
      }

      const pdfBlob = await response.blob();
      const downloadUrl = URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `Invoice-${invoice.invoice_number}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      showToast({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to download the invoice PDF.",
      });
    } finally {
      setIsDownloading(false);
    }
  }

  async function sendInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSending) return;

    const finalTo = uniqueEmails([...to, ...toInput.split(",")]);
    const finalCc = uniqueEmails([...cc, ...ccInput.split(",")]).filter(
      (email) =>
        !finalTo.some(
          (recipient) => recipient.toLowerCase() === email.toLowerCase(),
        ),
    );

    if (finalTo.length === 0) {
      showToast({ tone: "error", message: "Add at least one recipient." });
      return;
    }

    setIsSending(true);

    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        showToast({
          tone: "error",
          message: "Your session has expired. Please log in again.",
        });
        window.setTimeout(() => router.push("/login"), 1000);
        return;
      }

      const response = await fetch(`/api/invoices/${invoice.id}/send`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: finalTo,
          cc: finalCc,
          subject,
          message,
          idempotencyKey,
        }),
      });
      const result = await response.json().catch(() => null);

      if (!response.ok) {
        if (result?.emailWasSent === true && result?.gmailMessageId) {
          setRepairState({
            gmailMessageId: result.gmailMessageId,
            recipient: finalTo.join(", "),
            cc: finalCc,
            subject,
            message,
            databaseError: result.databaseError || null,
          });
          showToast({
            tone: "error",
            message:
              "Email was sent successfully, but Kairo could not update the invoice. Click Repair Status to complete the update without resending the email.",
          });
          return;
        }

        throw new Error(result?.error || "Invoice email could not be sent.");
      }

      onInvoiceSent(result.invoice as Partial<Invoice>);
      setIsModalOpen(false);
      router.refresh();
      showToast({
        tone: "success",
        message: `Invoice emailed to ${finalTo.join(", ")}.`,
      });
    } catch (error) {
      showToast({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Invoice email could not be sent.",
      });
    } finally {
      setIsSending(false);
    }
  }

  async function repairInvoiceStatus() {
    if (!repairState || isSending) return;
    setIsSending(true);

    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        showToast({
          tone: "error",
          message: "Your session has expired. Please log in again.",
        });
        window.setTimeout(() => router.push("/login"), 1000);
        return;
      }

      const response = await fetch(`/api/invoices/${invoice.id}/send`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          repairOnly: true,
          gmailMessageId: repairState.gmailMessageId,
          recipient: repairState.recipient,
          cc: repairState.cc,
          subject: repairState.subject,
          message: repairState.message,
        }),
      });
      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          result?.databaseError ||
            result?.error ||
            "Invoice status could not be repaired.",
        );
      }

      onInvoiceSent(result.invoice as Partial<Invoice>);
      setRepairState(null);
      setIsModalOpen(false);
      router.refresh();
      showToast({
        tone: "success",
        message:
          "Invoice status repaired successfully. The email was not resent.",
      });
    } catch (error) {
      showToast({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Invoice status could not be repaired.",
      });
    } finally {
      setIsSending(false);
    }
  }

  function openPaymentModal() {
    setPaymentDate(todayForInput());
    setPaymentMethod("bank_transfer");
    setPaymentReference("");
    setPaymentNotes("");
    setPaymentError("");
    setIsPaymentModalOpen(true);
  }

  async function recordPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isRecordingPayment) return;
    setIsRecordingPayment(true);
    setPaymentError("");

    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        setPaymentError("Your session has expired. Please log in again.");
        window.setTimeout(() => router.push("/login"), 1000);
        return;
      }

      const response = await fetch(
        `/api/invoices/${invoice.id}/record-payment`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: invoice.total_amount,
            paymentDate,
            paymentMethod,
            referenceNumber: paymentReference,
            notes: paymentNotes,
          }),
        },
      );
      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(result?.error || "Payment could not be recorded.");
      }

      onInvoiceSent(result.invoice as Partial<Invoice>);
      setIsPaymentModalOpen(false);
      router.refresh();
      showToast({
        tone: "success",
        message: "Payment recorded and Service Wallet credited.",
      });
    } catch (error) {
      setPaymentError(
        error instanceof Error
          ? error.message
          : "Payment could not be recorded.",
      );
    } finally {
      setIsRecordingPayment(false);
    }
  }

  function openDuplicateModal() {
    const issueDate = todayForInput();
    const paymentTerms = invoicePaymentTerms(
      invoice.issue_date,
      invoice.due_date,
    );
    setDuplicateIssueDate(issueDate);
    setDuplicateTerms(paymentTerms);
    setDuplicateDueDate(addDays(issueDate, paymentTerms));
    setDuplicateError("");
    setIsDuplicateModalOpen(true);
  }

  async function duplicateInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (duplicateRequestInFlight.current) return;
    if (!duplicateIssueDate || !duplicateDueDate) {
      setDuplicateError("Enter valid issue and due dates.");
      return;
    }
    if (duplicateDueDate < duplicateIssueDate) {
      setDuplicateError("Due date cannot be earlier than issue date.");
      return;
    }

    duplicateRequestInFlight.current = true;
    setIsDuplicating(true);
    setDuplicateError("");
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        setDuplicateError("Your session has expired. Please log in again.");
        window.setTimeout(() => router.push("/login"), 1000);
        return;
      }

      const response = await fetch(`/api/invoices/${invoice.id}/duplicate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          issueDate: duplicateIssueDate,
          dueDate: duplicateDueDate,
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(result?.error || "Invoice could not be duplicated.");
      }

      setIsDuplicateModalOpen(false);
      window.sessionStorage.setItem(
        "invoiceDuplicateSuccess",
        `Invoice duplicated as Draft #${result.invoiceNumber}.`,
      );
      router.push(`/invoices/${result.invoiceId}/edit`);
    } catch (error) {
      setDuplicateError(
        error instanceof Error
          ? error.message
          : "Invoice could not be duplicated.",
      );
    } finally {
      duplicateRequestInFlight.current = false;
      setIsDuplicating(false);
    }
  }

  function openReversalModal() {
    setReversalReason("");
    setCustomReversalReason("");
    setReversalNotes("");
    setReversalError("");
    setIsReversalModalOpen(true);
  }

  async function reversePayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isReversingPayment) return;

    const finalReason =
      reversalReason === "Other"
        ? customReversalReason.trim()
        : reversalReason.trim();
    if (!finalReason) {
      setReversalError("Select or enter a reversal reason.");
      return;
    }

    setIsReversingPayment(true);
    setReversalError("");
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        setReversalError("Your session has expired. Please log in again.");
        window.setTimeout(() => router.push("/login"), 1000);
        return;
      }

      const response = await fetch(
        `/api/invoices/${invoice.id}/reverse-payment`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reason: finalReason, notes: reversalNotes }),
        },
      );
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(result?.error || "Payment could not be reversed.");
      }

      onInvoiceSent(result.invoice as Partial<Invoice>);
      setIsReversalModalOpen(false);
      router.refresh();
      showToast({
        tone: "success",
        message: "Payment reversed and Service Wallet hours removed.",
      });
    } catch (error) {
      setReversalError(
        error instanceof Error
          ? error.message
          : "Payment could not be reversed.",
      );
    } finally {
      setIsReversingPayment(false);
    }
  }

  function openVoidModal() {
    setVoidReason("");
    setCustomVoidReason("");
    setVoidNotes("");
    setVoidError("");
    setIsVoidModalOpen(true);
  }

  async function voidInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (voidRequestInFlight.current) return;

    const finalReason =
      voidReason === "Other" ? customVoidReason.trim() : voidReason.trim();
    if (!finalReason) {
      setVoidError("Select or enter a void reason.");
      return;
    }

    voidRequestInFlight.current = true;
    setIsVoiding(true);
    setVoidError("");
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        setVoidError("Your session has expired. Please log in again.");
        window.setTimeout(() => router.push("/login"), 1000);
        return;
      }

      const response = await fetch(`/api/invoices/${invoice.id}/void`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: finalReason, notes: voidNotes }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(result?.error || "Invoice could not be voided.");
      }

      onInvoiceSent(result.invoice as Partial<Invoice>);
      setIsVoidModalOpen(false);
      router.refresh();
      showToast({ tone: "success", message: "Invoice voided successfully." });
    } catch (error) {
      setVoidError(
        error instanceof Error ? error.message : "Invoice could not be voided.",
      );
    } finally {
      voidRequestInFlight.current = false;
      setIsVoiding(false);
    }
  }

  async function stopReminders(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isUpdatingReminders) return;
    const reason = reminderStopReason.trim();
    if (!reason) {
      setReminderError("Reason is required.");
      return;
    }
    setIsUpdatingReminders(true);
    setReminderError("");
    try {
      const accessToken = await getAccessToken();
      if (!accessToken)
        throw new Error("Your session has expired. Please log in again.");
      const response = await fetch(
        `/api/invoices/${invoice.id}/stop-reminders`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reason }),
        },
      );
      const result = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(result?.error || "Reminders could not be stopped.");
      onInvoiceSent(result.invoice as Partial<Invoice>);
      setIsStopRemindersModalOpen(false);
      router.refresh();
      showToast({ tone: "success", message: "Automatic reminders stopped." });
    } catch (error) {
      setReminderError(
        error instanceof Error
          ? error.message
          : "Reminders could not be stopped.",
      );
    } finally {
      setIsUpdatingReminders(false);
    }
  }

  async function resumeReminders() {
    if (isUpdatingReminders) return;
    setIsUpdatingReminders(true);
    try {
      const accessToken = await getAccessToken();
      if (!accessToken)
        throw new Error("Your session has expired. Please log in again.");
      const response = await fetch(
        `/api/invoices/${invoice.id}/resume-reminders`,
        { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } },
      );
      const result = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(result?.error || "Reminders could not be resumed.");
      onInvoiceSent(result.invoice as Partial<Invoice>);
      router.refresh();
      showToast({ tone: "success", message: "Automatic reminders resumed." });
    } catch (error) {
      showToast({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Reminders could not be resumed.",
      });
    } finally {
      setIsUpdatingReminders(false);
    }
  }

  async function deleteDraft() {
    if (!canDeleteDraft || isDeletingDraft) return;
    setIsDeletingDraft(true);
    setDeleteDraftError("");
    try {
      const accessToken = await getAccessToken();
      if (!accessToken)
        throw new Error("Your session has expired. Please log in again.");
      const response = await fetch(
        `/api/invoices/${invoice.id}/delete-recurring-draft`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      const result = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(result?.error || "Unable to delete Draft.");
      router.push("/invoices?tab=all");
      router.refresh();
    } catch (error) {
      setDeleteDraftError(
        error instanceof Error
          ? error.message
          : "Unable to delete Draft.",
      );
    } finally {
      setIsDeletingDraft(false);
    }
  }

  return (
    <>
      {toast ? (
        <div
          role="status"
          className={`fixed right-6 top-6 z-[70] max-w-sm rounded-2xl px-5 py-4 text-sm font-semibold shadow-xl ring-1 ${
            toast.tone === "success"
              ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
              : "bg-red-50 text-red-800 ring-red-200"
          }`}
        >
          {toast.message}
        </div>
      ) : null}

      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-lg font-bold text-slate-950">Actions</h2>

        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={() =>
              router.push(`/invoices/${invoice.id}/edit`)
            }
            disabled={invoice.status.toLowerCase() !== "draft"}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-left font-semibold transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
          >
            Edit Draft
          </button>

          <button
            type="button"
            onClick={() =>
              repairState ? setIsModalOpen(true) : openSendModal()
            }
            disabled={isSending || (!repairState && !canSendInvoice)}
            className="w-full rounded-xl bg-[#153E90] px-4 py-3 text-left font-semibold text-white transition hover:bg-[#123578] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {repairState
              ? "Repair Status"
              : invoice.status.toLowerCase() === "sent"
                ? "Resend Invoice"
                : "Send Invoice"}
          </button>

          <button
            type="button"
            onClick={downloadPdf}
            disabled={isDownloading}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-left font-semibold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isDownloading ? "Preparing PDF..." : "Download PDF"}
          </button>

          {isAdmin ? (
            <button
              type="button"
              onClick={openDuplicateModal}
              disabled={isDuplicating}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-left font-semibold text-slate-800 transition hover:border-blue-200 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Duplicate Invoice
            </button>
          ) : null}

          {isAdmin &&
          !invoice.generated_from_recurring &&
          ["draft", "sent", "paid"].includes(normalizedStatus) ? (
            <button
              type="button"
              onClick={() =>
                router.push(
                  `/invoices/recurring/new?sourceInvoiceId=${invoice.id}`,
                )
              }
              className="w-full rounded-xl border border-violet-200 px-4 py-3 text-left font-semibold text-violet-700 transition hover:bg-violet-50"
            >
              Make Recurring
            </button>
          ) : null}

          {canRecordPayment ? (
            <button
              type="button"
              onClick={openPaymentModal}
              disabled={isRecordingPayment}
              className="w-full rounded-xl border border-emerald-200 px-4 py-3 text-left font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Record Payment
            </button>
          ) : null}

          {isAdmin && normalizedStatus === "paid" ? (
            <button
              type="button"
              onClick={openReversalModal}
              disabled={isReversingPayment}
              className="w-full rounded-xl border border-red-300 px-4 py-3 text-left font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Reverse Payment
            </button>
          ) : null}

          {isAdmin && ["sent", "overdue"].includes(normalizedStatus) ? (
            <button
              type="button"
              onClick={openVoidModal}
              disabled={isVoiding}
              className="w-full rounded-xl border border-red-300 px-4 py-3 text-left font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Void Invoice
            </button>
          ) : null}

          {isAdmin && ["sent", "overdue"].includes(normalizedStatus) ? (
            invoice.reminders_enabled ? (
              <button
                type="button"
                onClick={() => {
                  setReminderStopReason("");
                  setReminderError("");
                  setIsStopRemindersModalOpen(true);
                }}
                disabled={isUpdatingReminders}
                className="w-full rounded-xl border border-amber-300 px-4 py-3 text-left font-semibold text-amber-800 transition hover:bg-amber-50 disabled:opacity-60"
              >
                Stop Reminders
              </button>
            ) : (
              <button
                type="button"
                onClick={resumeReminders}
                disabled={isUpdatingReminders}
                className="w-full rounded-xl border border-blue-200 px-4 py-3 text-left font-semibold text-[#153E90] transition hover:bg-blue-50 disabled:opacity-60"
              >
                {isUpdatingReminders ? "Resuming..." : "Resume Reminders"}
              </button>
            )
          ) : null}

          {canDeleteDraft ? (
            <>
              <div className="my-3 border-t border-slate-200" />
              <button
                type="button"
                onClick={() => {
                  setDeleteDraftError("");
                  setIsDeleteDraftModalOpen(true);
                }}
                className="w-full rounded-xl border border-red-200 px-4 py-3 text-left font-semibold text-red-600 hover:bg-red-50"
              >
                {invoice.generated_from_recurring
                  ? "Delete Recurring Draft"
                  : "Delete Draft"}
              </button>
            </>
          ) : null}
        </div>
      </div>

      {isDeleteDraftModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-draft-title"
        >
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-slate-200">
            <h2
              id="delete-draft-title"
              className="text-xl font-bold text-slate-950"
            >
              {invoice.generated_from_recurring
                ? "Delete recurring Draft?"
                : "Delete Draft invoice?"}
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {invoice.generated_from_recurring
                ? "This removes this Draft invoice only. The recurring schedule and its future occurrences will remain active."
                : "This permanently removes this one-time Draft invoice and its line items."}
            </p>
            {deleteDraftError ? (
              <div
                role="alert"
                className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
              >
                {deleteDraftError}
              </div>
            ) : null}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsDeleteDraftModalOpen(false)}
                disabled={isDeletingDraft}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600"
              >
                Keep Draft
              </button>
              <button
                type="button"
                onClick={() => void deleteDraft()}
                disabled={isDeletingDraft}
                className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {isDeletingDraft ? "Deleting…" : "Delete Draft"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="send-invoice-title"
        >
          <form
            onSubmit={sendInvoice}
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200"
          >
            <div className="relative border-b border-slate-200 px-7 py-6 pr-16">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                disabled={isSending}
                aria-label="Close send invoice"
                className="absolute right-6 top-6 flex h-9 w-9 items-center justify-center rounded-full text-2xl leading-none text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                ×
              </button>
              <p className="text-sm font-semibold text-[#153E90]">
                Email invoice
              </p>
              <h2
                id="send-invoice-title"
                className="mt-1 text-2xl font-bold text-slate-950"
              >
                Send Invoice #{invoice.invoice_number}
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                The latest PDF will be generated and attached automatically.
              </p>
            </div>

            <div className="space-y-5 px-7 py-6">
              {repairState ? (
                <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                  <p className="font-bold">The email was sent successfully.</p>
                  <p className="mt-1 leading-6">
                    Email was sent successfully, but Kairo could not update the
                    invoice. Click Repair Status to complete the update without
                    resending the email.
                  </p>
                  {repairState.databaseError ? (
                    <p className="mt-2 break-words text-xs text-amber-800">
                      Database error: {repairState.databaseError}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <RecipientField
                label="To"
                emails={to}
                input={toInput}
                placeholder="billing@client.com"
                autoFocus
                onInputChange={setToInput}
                onAdd={() => {
                  setTo((current) =>
                    uniqueEmails([...current, ...toInput.split(",")]),
                  );
                  setToInput("");
                }}
                onRemove={(email) =>
                  setTo((current) => current.filter((item) => item !== email))
                }
              />

              <RecipientField
                label="CC"
                emails={cc}
                input={ccInput}
                placeholder="Optional CC email"
                onInputChange={setCcInput}
                onAdd={() => {
                  setCc((current) =>
                    uniqueEmails([...current, ...ccInput.split(",")]),
                  );
                  setCcInput("");
                }}
                onRemove={(email) =>
                  setCc((current) => current.filter((item) => item !== email))
                }
              />

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">
                  Subject
                </span>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-[#153E90] focus:ring-4 focus:ring-blue-100"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">
                  Message
                </span>
                <textarea
                  required
                  rows={10}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  className="mt-2 w-full resize-y rounded-xl border border-slate-300 px-4 py-3 text-sm leading-6 text-slate-950 outline-none transition focus:border-[#153E90] focus:ring-4 focus:ring-blue-100"
                />
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-7 py-5">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                disabled={isSending}
                className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
              >
                Cancel
              </button>
              {repairState ? (
                <button
                  type="button"
                  onClick={repairInvoiceStatus}
                  disabled={isSending}
                  className="rounded-xl bg-amber-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSending ? "Repairing..." : "Repair Status"}
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isSending}
                  className="rounded-xl bg-[#153E90] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#123578] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSending ? "Sending..." : "Send Invoice"}
                </button>
              )}
            </div>
          </form>
        </div>
      ) : null}

      {isStopRemindersModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="stop-reminders-title"
        >
          <form
            onSubmit={stopReminders}
            className="w-full max-w-lg rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200"
          >
            <div className="border-b border-slate-200 px-7 py-6">
              <h2
                id="stop-reminders-title"
                className="text-2xl font-bold text-slate-950"
              >
                Stop Invoice Reminders
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Automatic reminder emails will stop for this invoice. This will
                not change the invoice status or outstanding balance.
              </p>
            </div>
            <div className="px-7 py-6">
              {reminderError ? (
                <div
                  role="alert"
                  className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
                >
                  {reminderError}
                </div>
              ) : null}
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">
                  Reason
                </span>
                <textarea
                  required
                  rows={4}
                  value={reminderStopReason}
                  onChange={(event) =>
                    setReminderStopReason(event.target.value)
                  }
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#153E90] focus:ring-4 focus:ring-blue-100"
                />
              </label>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-7 py-5">
              <button
                type="button"
                onClick={() => setIsStopRemindersModalOpen(false)}
                disabled={isUpdatingReminders}
                className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isUpdatingReminders}
                className="rounded-xl bg-amber-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {isUpdatingReminders ? "Stopping..." : "Stop Reminders"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {isVoidModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="void-invoice-title"
        >
          <form
            onSubmit={voidInvoice}
            className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200"
          >
            <div className="relative border-b border-slate-200 px-7 py-6 pr-16">
              <button
                type="button"
                onClick={() => setIsVoidModalOpen(false)}
                disabled={isVoiding}
                aria-label="Close void invoice"
                className="absolute right-6 top-6 flex h-9 w-9 items-center justify-center rounded-full text-2xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
              >
                ×
              </button>
              <p className="text-sm font-semibold text-red-700">
                Audit-preserving action
              </p>
              <h2
                id="void-invoice-title"
                className="mt-1 text-2xl font-bold text-slate-950"
              >
                Void Invoice
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                This invoice has already been sent. Voiding it will prevent
                further payment or resending, but the invoice will remain in
                Kairo for audit purposes.
              </p>
            </div>
            <div className="space-y-5 px-7 py-6">
              {voidError ? (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
                >
                  {voidError}
                </div>
              ) : null}
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">
                  Reason
                </span>
                <select
                  required
                  value={voidReason}
                  onChange={(event) => {
                    setVoidReason(event.target.value);
                    setVoidError("");
                  }}
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100"
                >
                  <option value="">Select a reason</option>
                  {VOID_REASONS.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
              </label>
              {voidReason === "Other" ? (
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">
                    Custom Reason
                  </span>
                  <input
                    required
                    value={customVoidReason}
                    onChange={(event) =>
                      setCustomVoidReason(event.target.value)
                    }
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100"
                  />
                </label>
              ) : null}
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">
                  Notes{" "}
                  <span className="font-normal text-slate-400">(optional)</span>
                </span>
                <textarea
                  rows={4}
                  value={voidNotes}
                  onChange={(event) => setVoidNotes(event.target.value)}
                  className="mt-2 w-full resize-y rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100"
                />
              </label>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-7 py-5">
              <button
                type="button"
                onClick={() => setIsVoidModalOpen(false)}
                disabled={isVoiding}
                className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isVoiding}
                className="rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isVoiding ? "Voiding..." : "Void Invoice"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {isReversalModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reverse-payment-title"
        >
          <form
            onSubmit={reversePayment}
            className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200"
          >
            <div className="relative border-b border-slate-200 px-7 py-6 pr-16">
              <button
                type="button"
                onClick={() => setIsReversalModalOpen(false)}
                disabled={isReversingPayment}
                aria-label="Close reverse payment"
                className="absolute right-6 top-6 flex h-9 w-9 items-center justify-center rounded-full text-2xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
              >
                ×
              </button>
              <p className="text-sm font-semibold text-red-700">
                Payment reversal
              </p>
              <h2
                id="reverse-payment-title"
                className="mt-1 text-2xl font-bold text-slate-950"
              >
                Reverse Payment
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                This will return the invoice to Sent status and remove the hours
                credited to the linked project wallets. The original payment and
                wallet entries will remain in the audit history.
              </p>
            </div>
            <div className="space-y-5 px-7 py-6">
              {reversalError ? (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
                >
                  {reversalError}
                </div>
              ) : null}
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">
                  Reason
                </span>
                <select
                  required
                  value={reversalReason}
                  onChange={(event) => {
                    setReversalReason(event.target.value);
                    setReversalError("");
                  }}
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100"
                >
                  <option value="">Select a reason</option>
                  {REVERSAL_REASONS.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
              </label>
              {reversalReason === "Other" ? (
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">
                    Custom Reason
                  </span>
                  <input
                    required
                    value={customReversalReason}
                    onChange={(event) =>
                      setCustomReversalReason(event.target.value)
                    }
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100"
                  />
                </label>
              ) : null}
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">
                  Notes{" "}
                  <span className="font-normal text-slate-400">(optional)</span>
                </span>
                <textarea
                  rows={4}
                  value={reversalNotes}
                  onChange={(event) => setReversalNotes(event.target.value)}
                  className="mt-2 w-full resize-y rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100"
                />
              </label>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-7 py-5">
              <button
                type="button"
                onClick={() => setIsReversalModalOpen(false)}
                disabled={isReversingPayment}
                className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isReversingPayment}
                className="rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isReversingPayment ? "Reversing..." : "Reverse Payment"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {isDuplicateModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="duplicate-invoice-title"
        >
          <form
            onSubmit={duplicateInvoice}
            className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200"
          >
            <div className="relative border-b border-slate-200 px-7 py-6 pr-16">
              <button
                type="button"
                onClick={() => setIsDuplicateModalOpen(false)}
                disabled={isDuplicating}
                aria-label="Close duplicate invoice"
                className="absolute right-6 top-6 flex h-9 w-9 items-center justify-center rounded-full text-2xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
              >
                ×
              </button>
              <p className="text-sm font-semibold text-[#153E90]">
                Create draft copy
              </p>
              <h2
                id="duplicate-invoice-title"
                className="mt-1 text-2xl font-bold text-slate-950"
              >
                Duplicate Invoice
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                This will create a new draft invoice using the same client,
                projects, line items, hours, amounts, currency, and payment
                instructions.
              </p>
            </div>

            <div className="space-y-5 px-7 py-6">
              {duplicateError ? (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
                >
                  {duplicateError}
                </div>
              ) : null}

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">
                  Issue Date
                </span>
                <input
                  type="date"
                  required
                  value={duplicateIssueDate}
                  onChange={(event) => {
                    const value = event.target.value;
                    setDuplicateIssueDate(value);
                    if (value)
                      setDuplicateDueDate(addDays(value, duplicateTerms));
                  }}
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#153E90] focus:ring-4 focus:ring-blue-100"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">
                  Payment Terms
                </span>
                <div className="mt-2 flex items-center overflow-hidden rounded-xl border border-slate-300">
                  <span className="bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500">
                    Net
                  </span>
                  <input
                    type="number"
                    min="0"
                    required
                    value={duplicateTerms}
                    onChange={(event) => {
                      const value = Math.max(
                        0,
                        Number(event.target.value || 0),
                      );
                      setDuplicateTerms(value);
                      if (duplicateIssueDate)
                        setDuplicateDueDate(addDays(duplicateIssueDate, value));
                    }}
                    className="w-full px-4 py-3 text-sm outline-none"
                  />
                  <span className="bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500">
                    Days
                  </span>
                </div>
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">
                  Due Date
                </span>
                <input
                  type="date"
                  required
                  value={duplicateDueDate}
                  min={duplicateIssueDate}
                  onChange={(event) => setDuplicateDueDate(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#153E90] focus:ring-4 focus:ring-blue-100"
                />
              </label>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-7 py-5">
              <button
                type="button"
                onClick={() => setIsDuplicateModalOpen(false)}
                disabled={isDuplicating}
                className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isDuplicating}
                className="rounded-xl bg-[#153E90] px-5 py-3 text-sm font-semibold text-white hover:bg-[#123578] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDuplicating ? "Duplicating..." : "Duplicate Invoice"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {isPaymentModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="record-payment-title"
        >
          <form
            onSubmit={recordPayment}
            className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200"
          >
            <div className="relative border-b border-slate-200 px-7 py-6 pr-16">
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                disabled={isRecordingPayment}
                aria-label="Close record payment"
                className="absolute right-6 top-6 flex h-9 w-9 items-center justify-center rounded-full text-2xl leading-none text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
              >
                ×
              </button>
              <p className="text-sm font-semibold text-emerald-700">
                Service Wallet credit
              </p>
              <h2
                id="record-payment-title"
                className="mt-1 text-2xl font-bold text-slate-950"
              >
                Record Payment
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Invoice #{invoice.invoice_number} will be marked Paid and its
                project hours credited automatically.
              </p>
            </div>

            <div className="space-y-5 px-7 py-6">
              {paymentError ? (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
                >
                  {paymentError}
                </div>
              ) : null}

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">
                  Amount Received
                </span>
                <div className="mt-2 flex overflow-hidden rounded-xl border border-slate-300 bg-slate-50">
                  <span className="border-r border-slate-300 px-4 py-3 text-sm font-bold text-slate-500">
                    {invoice.currency}
                  </span>
                  <input
                    type="text"
                    readOnly
                    value={Number(invoice.total_amount || 0).toFixed(2)}
                    className="w-full bg-transparent px-4 py-3 text-sm font-bold text-slate-950 outline-none"
                  />
                </div>
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">
                  Payment Date
                </span>
                <input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(event) => setPaymentDate(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-950 outline-none focus:border-[#153E90] focus:ring-4 focus:ring-blue-100"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">
                  Payment Method
                </span>
                <select
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none focus:border-[#153E90] focus:ring-4 focus:ring-blue-100"
                >
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="credit_card">Credit Card</option>
                  <option value="ach">ACH</option>
                  <option value="cheque">Cheque</option>
                  <option value="cash">Cash</option>
                  <option value="other">Other</option>
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">
                  Reference Number{" "}
                  <span className="font-normal text-slate-400">(optional)</span>
                </span>
                <input
                  type="text"
                  value={paymentReference}
                  onChange={(event) => setPaymentReference(event.target.value)}
                  placeholder="RBC-12345"
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-950 outline-none focus:border-[#153E90] focus:ring-4 focus:ring-blue-100"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">
                  Notes{" "}
                  <span className="font-normal text-slate-400">(optional)</span>
                </span>
                <textarea
                  rows={3}
                  value={paymentNotes}
                  onChange={(event) => setPaymentNotes(event.target.value)}
                  placeholder="Received by wire transfer"
                  className="mt-2 w-full resize-y rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-950 outline-none focus:border-[#153E90] focus:ring-4 focus:ring-blue-100"
                />
              </label>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-7 py-5">
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                disabled={isRecordingPayment}
                className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isRecordingPayment}
                className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRecordingPayment ? "Recording..." : "Record Payment"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}

export type PublicInvoiceItem = {
  description: string;
  hours: number;
  quantity: number;
  amount: number;
  projectName: string | null;
  projectCode: string | null;
};

export type PublicInvoice = {
  invoiceNumber: number;
  clientName: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  totalAmount: number;
  status: string;
  state: "payable" | "paid" | "void" | "unavailable";
  checkoutStatus: string | null;
  failureMessage: string | null;
  autopayEligible: boolean;
  autopayEnabled: boolean;
  items: PublicInvoiceItem[];
};

export type PublicPaymentStatus =
  | "unpaid"
  | "requires_payment_method"
  | "requires_action"
  | "processing"
  | "succeeded"
  | "failed"
  | "paid"
  | "void"
  | "unavailable";

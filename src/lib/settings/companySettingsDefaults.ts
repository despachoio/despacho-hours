export type CompanySettings = {
  id: string | null;
  company_name: string;
  legal_name: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state_province: string | null;
  postal_code: string | null;
  country: string | null;
  business_email: string | null;
  website: string | null;
  phone: string | null;
  logo_url: string | null;
  invoice_logo_url: string | null;
  default_currency: "USD" | "CAD" | "INR";
  default_payment_terms_days: number;
  invoice_number_prefix: string | null;
  invoice_number_start: number;
  default_tax_rate: number;
  tax_label: string;
  tax_registration_number: string | null;
  bank_name: string | null;
  bank_address: string | null;
  institution_number: string | null;
  routing_number: string | null;
  swift_bic: string | null;
  transit_number: string | null;
  account_number: string | null;
  account_name: string | null;
  payroll_bank_customer_id: string | null;
  payroll_bank_account_number: string | null;
  payroll_bank_ifsc_code: string | null;
  payment_instructions: string | null;
  default_invoice_notes: string | null;
  default_reminder_before_due_days: number[];
  default_reminder_after_due_days: number[];
  default_reminder_subject: string | null;
  default_friendly_reminder_message: string | null;
  default_overdue_reminder_message: string | null;
  default_recurring_frequency: "monthly" | "quarterly" | "annually" | "custom";
  default_recurring_generate_as_draft: boolean;
  timezone: string;
  date_format: "DD MMM YYYY" | "DD-MM-YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
  time_format: "12h" | "24h";
  updated_at?: string;
  updated_by?: string | null;
};

export const DEFAULT_COMPANY_SETTINGS: CompanySettings = {
  id: null,
  company_name: "Despacho Inc.",
  legal_name: "Despacho Inc.",
  address_line_1: "900, 332 6th Avenue S.W.",
  address_line_2: null,
  city: "Calgary",
  state_province: "Alberta",
  postal_code: "T2P 0B1",
  country: "Canada",
  business_email: "sales@despacho.io",
  website: "https://www.despacho.io",
  phone: null,
  logo_url: "/kairo-logo-full.png",
  invoice_logo_url: "/despacho-logo-full.png",
  default_currency: "USD",
  default_payment_terms_days: 7,
  invoice_number_prefix: null,
  invoice_number_start: 1001,
  default_tax_rate: 0,
  tax_label: "Tax",
  tax_registration_number: null,
  bank_name: "Royal Bank of Canada",
  bank_address: "P.O. BAG SERVICE 2650, Calgary, Alberta, Canada T2P 2M7",
  institution_number: "003",
  routing_number: "021000021",
  swift_bic: "ROYCCAT2",
  transit_number: "01549",
  account_number: "4002036",
  account_name: "Despacho Inc",
  payroll_bank_customer_id: null,
  payroll_bank_account_number: null,
  payroll_bank_ifsc_code: null,
  payment_instructions: "Thank you for choosing Despacho.",
  default_invoice_notes: null,
  default_reminder_before_due_days: [7, 3, 1],
  default_reminder_after_due_days: [1, 7, 14, 30],
  default_reminder_subject: "Payment reminder for Invoice #{{invoice_number}}",
  default_friendly_reminder_message:
    "Hi {{client_name}},\n\nThis is a friendly reminder that Invoice #{{invoice_number}} for {{amount}} is due on {{due_date}}.\n\nThank you.\n\nRegards,\n{{company_name}}",
  default_overdue_reminder_message:
    "Hi {{client_name}},\n\nInvoice #{{invoice_number}} for {{amount}} was due on {{due_date}} and remains outstanding.\n\nPlease arrange payment at your earliest convenience.\n\nRegards,\n{{company_name}}",
  default_recurring_frequency: "monthly",
  default_recurring_generate_as_draft: true,
  timezone: "Asia/Kolkata",
  date_format: "DD MMM YYYY",
  time_format: "12h",
};

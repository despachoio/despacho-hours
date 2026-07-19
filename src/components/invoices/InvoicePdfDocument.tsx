import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";
import { DEFAULT_COMPANY_SETTINGS } from "@/lib/settings/companySettingsDefaults";
import { formatDecimalHours } from "@/lib/format-hours";

type ClientSummary = {
  id: string;
  name: string;
  primary_contact?: string | null;
  contact_name?: string | null;
  email?: string | null;
  address?: string | null;
} | null;

type ProjectSummary = {
  id: string;
  name: string;
  project_code: string | null;
} | null;

type InvoicePdfItem = {
  description: string;
  hours: number;
  amount: number;
  unit_price?: number | null;
  projects: ProjectSummary;
};

type InvoicePdfData = {
  id: string;
  invoice_number: number | null;
  issue_date: string;
  due_date: string;
  currency: string;
  subtotal: number;
  tax_amount: number;
  discount_amount?: number | null;
  total_amount: number;
  hours_purchased: number;
  status?: string | null;
  notes: string | null;
  clients: ClientSummary;
};

type Props = {
  invoice: InvoicePdfData;
  items: InvoicePdfItem[];
  logoSrc: string;
  companySettings?: {
    company_name?: string | null;
    legal_name?: string | null;
    address_line_1?: string | null;
    address_line_2?: string | null;
    city?: string | null;
    state_province?: string | null;
    postal_code?: string | null;
    country?: string | null;
    business_email?: string | null;
    website?: string | null;
    phone?: string | null;
    tax_label?: string | null;
    tax_registration_number?: string | null;
    bank_name?: string | null;
    bank_address?: string | null;
    institution_number?: string | null;
    routing_number?: string | null;
    swift_bic?: string | null;
    transit_number?: string | null;
    account_number?: string | null;
    account_name?: string | null;
    payment_instructions?: string | null;
  };
};

const NAVY = "#0F172A";
const BLUE = "#153E90";
const MUTED = "#6B7280";
const BORDER = "#E5E7EB";
const LIGHT = "#F8FAFC";

const styles = StyleSheet.create({
  page: {
    paddingTop: 190,
    paddingRight: 38,
    paddingBottom: 86,
    paddingLeft: 38,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: NAVY,
    backgroundColor: "#FFFFFF",
  },
  voidWatermark: {
    position: "absolute",
    top: 330,
    left: 105,
    fontSize: 88,
    fontWeight: "bold",
    letterSpacing: 12,
    color: "#DC2626",
    opacity: 0.1,
    transform: "rotate(-35deg)",
  },
  header: {
    position: "absolute",
    top: 34,
    left: 38,
    right: 38,
    height: 142,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  brand: {
    width: "55%",
  },
  logo: {
    width: 150,
    height: 42,
    objectFit: "contain",
    objectPosition: "left center",
  },
  brandDetails: {
    marginTop: 10,
    fontSize: 7.8,
    lineHeight: 1.4,
    color: MUTED,
  },
  invoiceBlock: {
    width: "41%",
    alignItems: "flex-end",
  },
  invoiceHeading: {
    fontSize: 22,
    fontWeight: "bold",
    letterSpacing: 1.8,
    color: NAVY,
  },
  invoiceNumber: {
    fontSize: 14,
    fontWeight: "bold",
    color: BLUE,
    marginTop: 2,
    marginBottom: 13,
  },
  metaRow: {
    width: 185,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2.5,
  },
  metaLabel: {
    fontSize: 8,
    color: MUTED,
  },
  metaValue: {
    fontSize: 8.5,
    color: NAVY,
    fontWeight: "bold",
  },
  statusBadge: {
    borderRadius: 8,
    paddingVertical: 3,
    paddingHorizontal: 8,
    fontSize: 7.5,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  billToCard: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 7,
    paddingVertical: 8,
    paddingHorizontal: 11,
    marginBottom: 14,
    backgroundColor: LIGHT,
  },
  eyebrow: {
    fontSize: 8,
    fontWeight: "bold",
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: BLUE,
    marginBottom: 3,
  },
  clientName: {
    fontSize: 11.5,
    fontWeight: "bold",
    color: NAVY,
    marginBottom: 2,
  },
  clientDetail: {
    fontSize: 9,
    color: MUTED,
    lineHeight: 1.3,
  },
  table: {
    marginBottom: 18,
  },
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 30,
    paddingHorizontal: 9,
    backgroundColor: NAVY,
    borderRadius: 6,
  },
  tableHeaderText: {
    color: "#FFFFFF",
    fontSize: 8,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 42,
    paddingVertical: 8,
    paddingHorizontal: 9,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  shadedRow: {
    backgroundColor: LIGHT,
  },
  projectCell: {
    width: "25%",
    paddingRight: 7,
  },
  descriptionCell: {
    width: "45%",
    paddingRight: 7,
  },
  hoursCell: {
    width: "12%",
    textAlign: "center",
  },
  amountCell: {
    width: "18%",
    textAlign: "right",
    paddingLeft: 5,
  },
  rowText: {
    fontSize: 8.5,
    lineHeight: 1.35,
    color: "#334155",
  },
  projectCode: {
    fontSize: 7.5,
    color: BLUE,
    fontWeight: "normal",
    marginBottom: 2,
  },
  projectName: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: NAVY,
    lineHeight: 1.25,
  },
  amountText: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: NAVY,
  },
  totalsWrap: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 20,
  },
  totals: {
    width: 235,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 7,
  },
  totalLabel: {
    fontSize: 9,
    color: MUTED,
  },
  totalValue: {
    fontSize: 9,
    color: NAVY,
    fontWeight: "bold",
  },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 2,
    borderTopColor: NAVY,
    paddingTop: 10,
    marginTop: 2,
  },
  grandTotalLabel: {
    fontSize: 12,
    fontWeight: "bold",
    color: NAVY,
  },
  grandTotalValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: BLUE,
  },
  paymentCard: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 9,
    padding: 14,
    backgroundColor: LIGHT,
  },
  paymentHeading: {
    fontSize: 9,
    fontWeight: "bold",
    letterSpacing: 0.8,
    color: NAVY,
    marginBottom: 9,
  },
  paymentNotes: {
    fontSize: 8.5,
    lineHeight: 1.4,
    color: MUTED,
    marginBottom: 9,
  },
  paymentThanks: {
    marginTop: 9,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    fontSize: 10,
    fontFamily: "Helvetica",
    fontWeight: "bold",
    color: BLUE,
  },
  bankRow: {
    flexDirection: "row",
    marginBottom: 3,
  },
  bankLabel: {
    width: 190,
    paddingRight: 8,
    fontSize: 8,
    lineHeight: 1.35,
    color: MUTED,
  },
  bankValue: {
    flex: 1,
    fontSize: 8,
    lineHeight: 1.35,
    color: NAVY,
    fontWeight: "bold",
  },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 38,
    right: 38,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 9,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  footerThanks: {
    fontSize: 8.5,
    color: MUTED,
  },
  footerBrand: {
    width: "34%",
    alignItems: "flex-end",
  },
  footerLeft: {
    width: "33%",
  },
  footerPage: {
    width: "33%",
    fontSize: 7.5,
    color: MUTED,
    textAlign: "center",
  },
  generatedBy: {
    fontSize: 5.5,
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  kairo: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: BLUE,
    letterSpacing: 1.5,
    marginVertical: 2,
  },
  footerDetail: {
    fontSize: 5.8,
    color: MUTED,
    lineHeight: 1.3,
    textAlign: "right",
  },
});

function formatDate(dateString: string) {
  if (!dateString) return "—";

  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatNumber(value: number | null | undefined) {
  return Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatMoney(currency: string, value: number | null | undefined) {
  return `${currency} ${formatNumber(value)}`;
}

function getPaymentTerms(issueDate: string, dueDate: string) {
  const issue = new Date(issueDate);
  const due = new Date(dueDate);

  if (Number.isNaN(issue.getTime()) || Number.isNaN(due.getTime())) {
    return "—";
  }

  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  const days = Math.max(
    0,
    Math.round(
      (Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate()) -
        Date.UTC(
          issue.getUTCFullYear(),
          issue.getUTCMonth(),
          issue.getUTCDate(),
        )) /
        millisecondsPerDay,
    ),
  );

  return `Net ${days} ${days === 1 ? "Day" : "Days"}`;
}

function getStatusStyle(status: string) {
  switch (status.trim().toLowerCase()) {
    case "sent":
      return { backgroundColor: "#DBEAFE", color: "#1D4ED8" };
    case "paid":
      return { backgroundColor: "#DCFCE7", color: "#15803D" };
    case "overdue":
      return { backgroundColor: "#FEE2E2", color: "#B91C1C" };
    case "void":
      return { backgroundColor: "#FEE2E2", color: "#B91C1C" };
    default:
      return { backgroundColor: "#E2E8F0", color: "#475569" };
  }
}

function getInvoiceNotes(notes: string | null) {
  return (
    notes?.replace(/bank account details followed:\s*/gi, "").trim() || null
  );
}

export function InvoicePdfDocument({
  invoice,
  items,
  logoSrc,
  companySettings,
}: Props) {
  const status = invoice.status?.trim() || "Draft";
  const client = invoice.clients;
  const primaryContact = client?.primary_contact || client?.contact_name;
  const discount = invoice.discount_amount || 0;
  const invoiceNotes = getInvoiceNotes(invoice.notes);
  const settings = { ...DEFAULT_COMPANY_SETTINGS, ...companySettings };
  const companyName = settings.company_name;
  const companyLocality = [
    settings.city,
    settings.state_province,
    settings.country,
    settings.postal_code,
  ]
    .filter(Boolean)
    .join(", ");
  const paymentNotes = invoiceNotes || settings.payment_instructions || null;
  const bankRows = [
    ["Bank Name", settings.bank_name],
    ["Bank Address", settings.bank_address],
    ["Institution Number", settings.institution_number],
    ["Routing / ABA", settings.routing_number],
    ["SWIFT BIC", settings.swift_bic],
    ["Transit", settings.transit_number],
    ["Account", settings.account_number],
    ["Account Name", settings.account_name],
  ].filter((row) => Boolean(row[1]));

  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        {status.trim().toLowerCase() === "void" ? (
          <Text style={styles.voidWatermark} fixed>
            VOID
          </Text>
        ) : null}
        <View style={styles.header} fixed>
          <View style={styles.brand}>
            {/* @react-pdf/renderer Image does not support the HTML alt prop. */}
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={logoSrc} style={styles.logo} />
            <View style={styles.brandDetails}>
              <Text>{companyName}</Text>
              {settings.legal_name && settings.legal_name !== companyName ? (
                <Text>{settings.legal_name}</Text>
              ) : null}
              <Text>{settings.address_line_1}</Text>
              {settings.address_line_2 ? (
                <Text>{settings.address_line_2}</Text>
              ) : null}
              <Text>{companyLocality}</Text>
              <Text> </Text>
              <Text>{settings.business_email}</Text>
              {settings.website ? <Text>{settings.website}</Text> : null}
              {settings.phone ? <Text>{settings.phone}</Text> : null}
            </View>
          </View>

          <View style={styles.invoiceBlock}>
            <Text style={styles.invoiceHeading}>INVOICE</Text>
            <Text style={styles.invoiceNumber}>
              {invoice.invoice_number ? `#${invoice.invoice_number}` : "DRAFT"}
            </Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Issue Date</Text>
              <Text style={styles.metaValue}>
                {formatDate(invoice.issue_date)}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Due Date</Text>
              <Text style={styles.metaValue}>
                {formatDate(invoice.due_date)}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Payment Terms</Text>
              <Text style={styles.metaValue}>
                {getPaymentTerms(invoice.issue_date, invoice.due_date)}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Status</Text>
              <Text style={[styles.statusBadge, getStatusStyle(status)]}>
                {status}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.billToCard} wrap={false}>
          <Text style={styles.eyebrow}>Bill To</Text>
          <Text style={styles.clientName}>{client?.name || "Client"}</Text>
          {primaryContact ? (
            <Text style={styles.clientDetail}>
              Primary Contact: {primaryContact}
            </Text>
          ) : null}
          {client?.email ? (
            <Text style={styles.clientDetail}>{client.email}</Text>
          ) : null}
          {client?.address ? (
            <Text style={styles.clientDetail}>{client.address}</Text>
          ) : null}
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader} fixed>
            <Text style={[styles.tableHeaderText, styles.projectCell]}>
              Project
            </Text>
            <Text style={[styles.tableHeaderText, styles.descriptionCell]}>
              Description
            </Text>
            <Text style={[styles.tableHeaderText, styles.hoursCell]}>
              Hours
            </Text>
            <Text style={[styles.tableHeaderText, styles.amountCell]}>
              Amount
            </Text>
          </View>

          {items.map((item, index) => {
            return (
              <View
                key={`${item.description}-${item.hours}-${item.amount}-${index}`}
                style={[styles.tableRow, index % 2 ? styles.shadedRow : {}]}
                wrap={false}
              >
                <View style={styles.projectCell}>
                  {item.projects?.project_code ? (
                    <Text style={styles.projectCode}>
                      {item.projects.project_code}
                    </Text>
                  ) : null}
                  <Text style={styles.projectName}>
                    {item.projects?.name || "Unassigned"}
                  </Text>
                </View>
                <Text style={[styles.rowText, styles.descriptionCell]}>
                  {item.description}
                </Text>
                <Text style={[styles.rowText, styles.hoursCell]}>
                  {formatDecimalHours(item.hours)}
                </Text>
                <Text style={[styles.amountText, styles.amountCell]}>
                  {formatMoney(invoice.currency, item.amount)}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={styles.totalsWrap} wrap={false}>
          <View style={styles.totals}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>
                {formatMoney(invoice.currency, invoice.subtotal)}
              </Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{settings.tax_label}</Text>
              <Text style={styles.totalValue}>
                {formatMoney(invoice.currency, invoice.tax_amount)}
              </Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Discount</Text>
              <Text style={styles.totalValue}>
                {formatMoney(invoice.currency, discount)}
              </Text>
            </View>
            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalLabel}>TOTAL</Text>
              <Text style={styles.grandTotalValue}>
                {formatMoney(invoice.currency, invoice.total_amount)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.paymentCard}>
          <Text style={styles.paymentHeading}>PAYMENT INFORMATION</Text>
          {settings.tax_registration_number ? (
            <Text style={styles.paymentNotes}>
              Tax Registration: {settings.tax_registration_number}
            </Text>
          ) : null}
          {paymentNotes ? (
            <Text style={styles.paymentNotes}>{paymentNotes}</Text>
          ) : null}
          {bankRows.map(([label, bankValue]) => (
            <View key={label} style={styles.bankRow} wrap={false}>
              <Text style={styles.bankLabel}>{label}</Text>
              <Text style={styles.bankValue}>{bankValue}</Text>
            </View>
          ))}
          <Text style={styles.paymentThanks}>
            Thank you for choosing {settings.company_name}.
          </Text>
        </View>

        <View style={styles.footer} fixed>
          <View style={styles.footerLeft}>
            <Text style={styles.footerThanks}>
              Thank you for your business.
            </Text>
          </View>
          <Text
            style={styles.footerPage}
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
          <View style={styles.footerBrand}>
            <Text style={styles.generatedBy}>Generated by</Text>
            <Text style={styles.kairo}>KAIRO</Text>
            <Text style={styles.footerDetail}>
              Professional Services Automation{"\n"}
              {settings.website}
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

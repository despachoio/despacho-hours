/* eslint-disable jsx-a11y/alt-text -- @react-pdf Image does not support HTML alt. */
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

const colors = { blue: "#153E90", navy: "#0F172A", slate: "#475569", line: "#CBD5E1", label: "#E8EDF4", paleBlue: "#EEF3F8", pale: "#F8FAFC" };
const styles = StyleSheet.create({
  page: { paddingTop: 30, paddingHorizontal: 38, paddingBottom: 38, fontFamily: "Helvetica", fontSize: 8, color: colors.navy, lineHeight: 1.35 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottom: `2 solid ${colors.blue}`, paddingBottom: 9, marginBottom: 12 },
  logo: { width: 72.5, height: 21, objectFit: "contain" },
  title: { fontSize: 13, fontWeight: 700, color: colors.blue, textAlign: "right" },
  meta: { fontSize: 8, color: colors.slate, textAlign: "right", marginTop: 5 },
  termsTitle: { fontSize: 15, fontWeight: 700, color: colors.blue, marginBottom: 8 },
  clause: { marginBottom: 8 },
  clauseTitle: { fontSize: 9, fontWeight: 700, color: colors.navy, marginBottom: 2 },
  body: { fontSize: 8, color: "#334155", textAlign: "justify" },
  compactBody: { fontSize: 7.5, color: "#334155", lineHeight: 1.3 },
  section: { marginTop: 9 },
  heading: { fontSize: 9.5, fontWeight: 700, color: colors.blue, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 5 },
  exhibit: { flexDirection: "row", border: `1 solid ${colors.line}`, borderRadius: 7, overflow: "hidden", backgroundColor: "#FFFFFF" },
  exhibitColumn: { width: "50%" },
  exhibitColumnRight: { width: "50%", borderLeft: `1 solid ${colors.line}` },
  fieldRow: { flexDirection: "row", minHeight: 21, borderBottom: "1 solid #E2E8F0" },
  fieldLabel: { width: "42%", paddingVertical: 4, paddingHorizontal: 6, backgroundColor: colors.label, color: colors.blue, fontWeight: 700, fontSize: 7 },
  fieldValue: { width: "58%", paddingVertical: 4, paddingHorizontal: 6, color: colors.navy, fontWeight: 600, fontSize: 7.2 },
  card: { border: `1 solid ${colors.line}`, borderRadius: 7, padding: 7, backgroundColor: "#FFFFFF" },
  phaseHeader: { flexDirection: "row", backgroundColor: colors.paleBlue, padding: 5 },
  phase: { flexDirection: "row", borderBottom: "1 solid #E2E8F0", padding: 5 },
  phaseName: { width: "28%", fontWeight: 700 }, phasePeriod: { width: "18%", color: colors.slate }, phaseTerms: { width: "32%", color: colors.slate }, phaseAmount: { width: "22%", fontWeight: 700, textAlign: "right" },
  bullet: { flexDirection: "row", marginBottom: 3 }, bulletMark: { width: 11, color: colors.blue, fontWeight: 700 }, bulletText: { flex: 1, fontSize: 7.3, color: "#334155", lineHeight: 1.25 },
  signatureGrid: { flexDirection: "row", gap: 18 },
  signatureColumn: { width: "50%", border: `1 solid ${colors.line}`, borderRadius: 7, padding: 7, backgroundColor: colors.pale },
  signatureParty: { fontSize: 8.5, fontWeight: 700, color: colors.blue, marginBottom: 5 },
  signatureLine: { flexDirection: "row", marginTop: 5 }, signatureLabel: { width: 32, color: colors.slate, fontSize: 7 }, signatureRule: { flex: 1, borderBottom: `1 solid ${colors.line}`, height: 8 },
  footer: { position: "absolute", bottom: 17, left: 38, right: 38, borderTop: `1 solid ${colors.line}`, paddingTop: 5, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: colors.slate },
});

type Section = { title: string; content: string };
type Phase = { label: string; currency: string; amount: number; billing_basis: string; description?: string | null; start_month?: number | null; end_month?: number | null };
type Snapshot = { workOrder: Record<string, unknown>; terms?: { structured_sections?: Section[] }; pricingPhases?: Phase[] };
type Props = { logoSrc: string; snapshot: Snapshot; version: number };
const present = (value: unknown) => value !== null && value !== undefined && value !== "";
const clean = (value: unknown) => String(value ?? "").replaceAll("_", " ");
const titleCase = (value: unknown) => clean(value).replace(/\b\w/g, (letter) => letter.toUpperCase());
const formatDate = (value: unknown) => {
  const raw = clean(value);
  if (!raw) return "—";
  const date = new Date(`${raw}T00:00:00`);
  return Number.isNaN(date.getTime()) ? raw : date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};
function CompactField({ label, value }: { label: string; value: unknown }) {
  return <View style={styles.fieldRow}><Text style={styles.fieldLabel}>{label}</Text><Text style={styles.fieldValue}>{present(value) ? clean(value) : "—"}</Text></View>;
}
function replaceTerms(content: string, workOrder: Record<string, unknown>) {
  return content.replaceAll("{{EFFECTIVE_DATE}}", clean(workOrder.effective_date)).replaceAll("{{CUSTOMER_NAME}}", clean(workOrder.company_name));
}
function Clause({ section, workOrder }: { section: Section; workOrder: Record<string, unknown> }) {
  return <View style={styles.clause}><Text style={styles.clauseTitle}>{section.title}</Text><Text style={styles.body}>{replaceTerms(section.content, workOrder)}</Text></View>;
}
function SignatureLine({ label }: { label: string }) {
  return <View style={styles.signatureLine}><Text style={styles.signatureLabel}>{label}</Text><View style={styles.signatureRule} /></View>;
}

export function WorkOrderPdfDocument({ logoSrc, snapshot }: Props) {
  const workOrder = snapshot.workOrder || {};
  const terms = snapshot.terms || {};
  const phases = snapshot.pricingPhases || [];
  const sections = Array.isArray(terms.structured_sections) ? terms.structured_sections : [];
  const commitment = workOrder.working_commitment_custom || (workOrder.hours_per_resource_month ? `${workOrder.hours_per_resource_month} hours / resource / month` : workOrder.hours_per_day ? `${workOrder.hours_per_day} hours / day${workOrder.days_per_week ? `, ${workOrder.days_per_week} days / week` : ""}` : "—");
  const ending = workOrder.ending_type === "specific_date" ? formatDate(workOrder.end_date) : workOrder.ending_type === "ongoing" ? "Ongoing" : clean(workOrder.ending_custom || workOrder.end_date || "Custom");
  const paymentTerms = workOrder.payment_terms_days ? `${workOrder.payment_terms_days} days` : clean(workOrder.payment_terms_custom || "As mutually agreed");
  const paymentTiming = workOrder.payment_terms_days ? `(${workOrder.payment_terms_days}) days following` : paymentTerms;
  const fee = workOrder.monthly_fee ? `${clean(workOrder.currency)} ${Number(workOrder.monthly_fee).toLocaleString("en-US")}` : "Custom pricing";
  return (
    <Document title={`Work Order ${clean(workOrder.work_order_number)}`} author="Despacho Inc.">
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header} fixed>
          <Image src={logoSrc} style={styles.logo} />
          <View><Text style={styles.title}>WORK ORDER {clean(workOrder.work_order_number)}</Text><Text style={styles.meta}>Customer ID {clean(workOrder.client_business_id || "Existing Client")}</Text></View>
        </View>
        <Text style={styles.termsTitle}>Despacho Terms of Service</Text>
        {sections.map((section, index) => <Clause key={`${section.title}-${index}`} section={section} workOrder={workOrder} />)}

        <View break style={styles.section} wrap={false}>
          <Text style={styles.heading}>Exhibit A — Work Order</Text>
          <View style={styles.exhibit}>
            <View style={styles.exhibitColumn}>
              <CompactField label="Company" value={workOrder.company_name} /><CompactField label="Primary Contact" value={workOrder.contact_name} /><CompactField label="Contact Email" value={workOrder.email} /><CompactField label="Effective Date" value={formatDate(workOrder.effective_date)} /><CompactField label="Project Starting Date" value={formatDate(workOrder.project_start_date)} /><CompactField label="Project Ending Date" value={ending} /><CompactField label="First Invoice Date" value={formatDate(workOrder.first_invoice_date)} />
            </View>
            <View style={styles.exhibitColumnRight}>
              <CompactField label="Service Type" value={titleCase(workOrder.service_type)} /><CompactField label="Engagement Model" value={titleCase(workOrder.engagement_model)} /><CompactField label="Billing Basis" value={titleCase(workOrder.billing_basis)} /><CompactField label="No. of Resources" value={workOrder.resource_count} /><CompactField label="Working Commitment" value={commitment} /><CompactField label="Monthly Fee" value={fee} /><CompactField label="Payment Terms" value={paymentTerms} />
            </View>
          </View>
        </View>

        {phases.length > 0 && <View style={styles.section} wrap={false}>
          <Text style={styles.heading}>Pricing Schedule</Text><View style={styles.card}><View style={styles.phaseHeader}><Text style={styles.phaseName}>Phase</Text><Text style={styles.phasePeriod}>Period</Text><Text style={styles.phaseTerms}>Basis / Notes</Text><Text style={styles.phaseAmount}>Amount</Text></View>
          {phases.map((phase, index) => <View key={`${phase.label}-${index}`} style={styles.phase}><Text style={styles.phaseName}>{phase.label}</Text><Text style={styles.phasePeriod}>{phase.start_month ? `M${phase.start_month}${phase.end_month ? `–M${phase.end_month}` : "+"}` : "—"}</Text><Text style={styles.phaseTerms}>{clean(phase.billing_basis)}{phase.description ? ` · ${phase.description}` : ""}</Text><Text style={styles.phaseAmount}>{phase.currency} {Number(phase.amount).toLocaleString("en-US")}</Text></View>)}</View>
        </View>}

        <View style={styles.section} wrap={false}><Text style={styles.heading}>Engagement Overview</Text><View style={styles.card}><Text style={styles.compactBody}>{clean(workOrder.engagement_overview) || "—"}</Text></View></View>
        <View style={styles.section} wrap={false}>
          <Text style={styles.heading}>Payment Details</Text><View style={styles.card}>
            <View style={styles.bullet}><Text style={styles.bulletMark}>•</Text><Text style={styles.bulletText}>All payment shall be billed at the beginning of service and payment is to be expected {paymentTiming}</Text></View>
            <View style={styles.bullet}><Text style={styles.bulletMark}>•</Text><Text style={styles.bulletText}>Any delay in payment will attract a penalty of one percent (1%) per month on the outstanding amount. This penalty is compounded if payments remain unpaid over several payment periods</Text></View>
            <View style={styles.bullet}><Text style={styles.bulletMark}>•</Text><Text style={styles.bulletText}>Any urgent turnaround or project requiring Despacho to work on weekends would be charged at premium and discussed with the Despacho Account Executive</Text></View>
          </View>
        </View>
        <View style={styles.section} wrap={false}>
          <Text style={styles.heading}>Signatures</Text><View style={styles.signatureGrid}>
            {["Despacho Inc.", clean(workOrder.company_name)].map((party) => <View key={party} style={styles.signatureColumn}><Text style={styles.signatureParty}>{party}</Text><SignatureLine label="Sign" /><SignatureLine label="Name" /><SignatureLine label="Title" /><SignatureLine label="Date" /></View>)}
          </View>
        </View>
        <View style={styles.footer} fixed><Text>Despacho Inc. · Confidential</Text><Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} /></View>
      </Page>
    </Document>
  );
}

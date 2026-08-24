/* eslint-disable jsx-a11y/alt-text -- @react-pdf Image does not support HTML alt. */
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

const colors = {
  blue: "#153E90",
  navy: "#0F172A",
  slate: "#475569",
  line: "#CBD5E1",
  pale: "#EFF6FF",
  cyan: "#0891B2",
};
const styles = StyleSheet.create({
  page: {
    paddingTop: 38,
    paddingHorizontal: 42,
    paddingBottom: 44,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: colors.navy,
    lineHeight: 1.45,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: `2 solid ${colors.blue}`,
    paddingBottom: 12,
    marginBottom: 16,
  },
  logo: { width: 72.5, height: 21, objectFit: "contain" },
  title: {
    fontSize: 18,
    fontWeight: 700,
    color: colors.blue,
    textAlign: "right",
  },
  meta: {
    fontSize: 8.5,
    color: colors.slate,
    textAlign: "right",
    marginTop: 3,
  },
  banner: {
    backgroundColor: colors.navy,
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
  },
  bannerTitle: { fontSize: 14, fontWeight: 700, color: "#FFFFFF" },
  bannerText: { fontSize: 8.5, color: "#DBEAFE", marginTop: 3 },
  section: { marginTop: 13 },
  heading: {
    fontSize: 10.5,
    fontWeight: 700,
    color: colors.blue,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 7,
  },
  card: {
    border: `1 solid ${colors.line}`,
    borderRadius: 8,
    padding: 10,
    backgroundColor: "#FFFFFF",
  },
  row: {
    flexDirection: "row",
    borderBottom: "1 solid #E2E8F0",
    paddingVertical: 5,
  },
  label: { width: "36%", color: colors.slate },
  value: { width: "64%", fontWeight: 600 },
  termsTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: colors.blue,
    marginBottom: 9,
  },
  clause: { marginBottom: 9 },
  clauseTitle: {
    fontSize: 9.5,
    fontWeight: 700,
    color: colors.navy,
    marginBottom: 2,
  },
  body: { fontSize: 8.3, color: "#334155", textAlign: "justify" },
  phaseHeader: {
    flexDirection: "row",
    backgroundColor: colors.pale,
    padding: 6,
  },
  phase: { flexDirection: "row", borderBottom: "1 solid #E2E8F0", padding: 6 },
  phaseName: { width: "28%", fontWeight: 700 },
  phasePeriod: { width: "18%", color: colors.slate },
  phaseTerms: { width: "32%", color: colors.slate },
  phaseAmount: { width: "22%", fontWeight: 700, textAlign: "right" },
  signature: { flexDirection: "row", gap: 24, marginTop: 24 },
  sign: { width: "48%", borderTop: `1 solid ${colors.line}`, paddingTop: 8 },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 42,
    right: 42,
    borderTop: `1 solid ${colors.line}`,
    paddingTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7.5,
    color: colors.slate,
  },
});
type Section = { title: string; content: string };
type Phase = {
  label: string;
  currency: string;
  amount: number;
  billing_basis: string;
  description?: string | null;
  start_month?: number | null;
  end_month?: number | null;
};
type Snapshot = {
  workOrder: Record<string, unknown>;
  terms?: { structured_sections?: Section[] };
  pricingPhases?: Phase[];
};
type Props = { logoSrc: string; snapshot: Snapshot; version: number };
const present = (value: unknown) =>
  value !== null && value !== undefined && value !== "";
const clean = (value: unknown) => String(value ?? "").replaceAll("_", " ");
function Field({ label, value }: { label: string; value: unknown }) {
  if (!present(value)) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{clean(value)}</Text>
    </View>
  );
}
function replaceTerms(content: string, workOrder: Record<string, unknown>) {
  return content
    .replaceAll("{{EFFECTIVE_DATE}}", clean(workOrder.effective_date))
    .replaceAll("{{CUSTOMER_NAME}}", clean(workOrder.company_name));
}
function Clause({
  section,
  workOrder,
}: {
  section: Section;
  workOrder: Record<string, unknown>;
}) {
  return (
    <View style={styles.clause}>
      <Text style={styles.clauseTitle}>{section.title}</Text>
      <Text style={styles.body}>
        {replaceTerms(section.content, workOrder)}
      </Text>
    </View>
  );
}

export function WorkOrderPdfDocument({ logoSrc, snapshot, version }: Props) {
  const workOrder = snapshot.workOrder || {};
  const terms = snapshot.terms || {};
  const phases = snapshot.pricingPhases || [];
  const sections = Array.isArray(terms.structured_sections)
    ? terms.structured_sections
    : [];
  const commitment =
    workOrder.working_commitment_custom ||
    (workOrder.hours_per_resource_month
      ? `${workOrder.hours_per_resource_month} hours / resource / month`
      : workOrder.hours_per_day
        ? `${workOrder.hours_per_day} hours / day${workOrder.days_per_week ? `, ${workOrder.days_per_week} days / week` : ""}`
        : null);
  const optionalClauses = [
    workOrder.long_term_clause_enabled && "Long-term engagement clause",
    workOrder.future_hires_clause_enabled && "Future hires clause",
    workOrder.additional_headcount_clause_enabled &&
      "Additional headcount clause",
    workOrder.premium_work_clause_enabled && "Premium work clause",
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Document
      title={`Work Order ${clean(workOrder.work_order_number)}`}
      author="Despacho Inc."
    >
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header} fixed>
          <Image src={logoSrc} style={styles.logo} />
          <View>
            <Text style={styles.title}>
              WORK ORDER {clean(workOrder.work_order_number)}
            </Text>
            <Text style={styles.meta}>
              Customer ID{" "}
              {clean(workOrder.client_business_id || "Existing Client")} ·
              Version {version}
            </Text>
          </View>
        </View>
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>
            {clean(workOrder.company_name)}
          </Text>
          <Text style={styles.bannerText}>
            {clean(workOrder.service_type)} ·{" "}
            {clean(workOrder.engagement_model)}
          </Text>
        </View>
        <Text style={styles.termsTitle}>Despacho Terms of Service</Text>
        {sections.map((section, index) => (
          <Clause
            key={`${section.title}-${index}`}
            section={section}
            workOrder={workOrder}
          />
        ))}
        <View break style={styles.section}>
          <Text style={styles.heading}>Exhibit A — Work Order</Text>
          <View style={styles.card}>
            <Field label="Company" value={workOrder.company_name} />
            <Field label="Primary Contact" value={workOrder.contact_name} />
            <Field label="Contact Email" value={workOrder.email} />
            <Field label="Effective Date" value={workOrder.effective_date} />
            <Field
              label="Project Starting Date"
              value={workOrder.project_start_date}
            />
            <Field
              label="Ending"
              value={
                workOrder.ending_type === "specific_date"
                  ? workOrder.end_date
                  : workOrder.ending_type
              }
            />
            <Field
              label="First Invoice Date"
              value={workOrder.first_invoice_date}
            />
            <Field label="Service Type" value={workOrder.service_type} />
            <Field
              label="Engagement Model"
              value={workOrder.engagement_model}
            />
            <Field
              label="Commercial Model"
              value={workOrder.commercial_model}
            />
            <Field label="Billing Basis" value={workOrder.billing_basis} />
            <Field label="Resources" value={workOrder.resource_count} />
            <Field label="Working Commitment" value={commitment} />
            <Field
              label="Monthly Fee"
              value={
                workOrder.monthly_fee
                  ? `${workOrder.currency} ${Number(workOrder.monthly_fee).toLocaleString("en-US")}`
                  : null
              }
            />
            <Field label="Location" value={workOrder.location} />
            <Field
              label="Payment Terms"
              value={
                workOrder.payment_terms_days
                  ? `${workOrder.payment_terms_days} days`
                  : workOrder.payment_terms_custom
              }
            />
            <Field
              label="Late Payment Terms"
              value={workOrder.late_payment_terms}
            />
            <Field
              label="Rate Increase Terms"
              value={workOrder.rate_increase_terms}
            />
          </View>
        </View>
        {phases.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.heading}>Pricing Schedule</Text>
            <View style={styles.card}>
              <View style={styles.phaseHeader}>
                <Text style={styles.phaseName}>Phase</Text>
                <Text style={styles.phasePeriod}>Period</Text>
                <Text style={styles.phaseTerms}>Basis / Notes</Text>
                <Text style={styles.phaseAmount}>Amount</Text>
              </View>
              {phases.map((phase, index) => (
                <View key={`${phase.label}-${index}`} style={styles.phase}>
                  <Text style={styles.phaseName}>{phase.label}</Text>
                  <Text style={styles.phasePeriod}>
                    {phase.start_month
                      ? `M${phase.start_month}${phase.end_month ? `–M${phase.end_month}` : "+"}`
                      : "—"}
                  </Text>
                  <Text style={styles.phaseTerms}>
                    {clean(phase.billing_basis)}
                    {phase.description ? ` · ${phase.description}` : ""}
                  </Text>
                  <Text style={styles.phaseAmount}>
                    {phase.currency}{" "}
                    {Number(phase.amount).toLocaleString("en-US")}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
        <View style={styles.section}>
          <Text style={styles.heading}>Engagement Overview</Text>
          <View style={styles.card}>
            <Text style={styles.body}>
              {clean(workOrder.engagement_overview)}
            </Text>
          </View>
        </View>
        {(optionalClauses ||
          present(workOrder.custom_terms) ||
          present(workOrder.pricing_notes)) && (
          <View style={styles.section}>
            <Text style={styles.heading}>Additional Commercial Terms</Text>
            <View style={styles.card}>
              <Field label="Enabled Clauses" value={optionalClauses} />
              <Field label="Pricing Notes" value={workOrder.pricing_notes} />
              <Field label="Custom Terms" value={workOrder.custom_terms} />
            </View>
          </View>
        )}
        <View style={styles.signature}>
          <View style={styles.sign}>
            <Text>Despacho Inc.</Text>
            <Text style={styles.meta}>Authorized signatory / Date</Text>
          </View>
          <View style={styles.sign}>
            <Text>{clean(workOrder.company_name)}</Text>
            <Text style={styles.meta}>Authorized signatory / Date</Text>
          </View>
        </View>
        <View style={styles.footer} fixed>
          <Text>Despacho Inc. · Confidential</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

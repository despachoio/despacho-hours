import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { GratuityRegisterRow } from "@/lib/payroll/gratuityRegister";

const BLUE = "#153E90";
const DARK = "#0F172A";
const BORDER = "#D5DFEC";

const styles = StyleSheet.create({
  page: { paddingHorizontal: 24, paddingTop: 22, paddingBottom: 30, fontFamily: "Helvetica", color: DARK, backgroundColor: "#FFFFFF" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  logo: { width: 126, height: 34, objectFit: "contain", objectPosition: "left center" },
  titleBlock: { alignItems: "flex-end" },
  eyebrow: { fontSize: 7, color: BLUE, fontWeight: "bold", letterSpacing: 1.4 },
  title: { marginTop: 4, fontSize: 17, color: DARK, fontWeight: "bold" },
  subtitle: { marginTop: 4, fontSize: 8, color: "#64748B" },
  divider: { marginTop: 11, height: 1.5, backgroundColor: BLUE },
  summary: { marginTop: 12, flexDirection: "row", gap: 8 },
  summaryCard: { flex: 1, borderWidth: 0.7, borderColor: BORDER, borderRadius: 7, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: "#F8FAFC" },
  summaryLabel: { fontSize: 6.5, color: "#64748B", fontWeight: "bold", letterSpacing: 0.8 },
  summaryValue: { marginTop: 4, fontSize: 11, color: BLUE, fontWeight: "bold" },
  context: { marginTop: 10, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: "#EFF6FF", fontSize: 7.2, color: "#334155" },
  table: { marginTop: 10, borderWidth: 0.7, borderColor: BORDER, borderRadius: 7, overflow: "hidden" },
  row: { minHeight: 22, flexDirection: "row", alignItems: "center", borderBottomWidth: 0.45, borderBottomColor: BORDER },
  alternate: { backgroundColor: "#F8FAFC" },
  headerRow: { minHeight: 27, backgroundColor: BLUE },
  cell: { paddingHorizontal: 5, fontSize: 6.8, color: "#1E293B" },
  headerCell: { paddingHorizontal: 5, fontSize: 6.1, fontWeight: "bold", color: "#FFFFFF", letterSpacing: 0.35 },
  code: { width: 58 },
  name: { width: 132 },
  joining: { width: 74 },
  tenure: { width: 73 },
  status: { width: 65 },
  basic: { width: 82, textAlign: "right" },
  eligibility: { width: 78 },
  amount: { flex: 1, textAlign: "right" },
  bold: { fontWeight: "bold" },
  amountText: { color: BLUE, fontWeight: "bold" },
  footer: { position: "absolute", bottom: 14, left: 24, right: 24, paddingTop: 6, borderTopWidth: 0.7, borderTopColor: BORDER, flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 6.5, color: "#64748B" },
});

const amount = (value: number) => Math.round(Number(value || 0)).toLocaleString("en-IN", { maximumFractionDigits: 0 });
const date = (value: string | null) => value ? new Date(`${value}T00:00:00Z`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : "-";
const tenure = (row: GratuityRegisterRow) => `${row.completedYears}y ${row.remainingMonths}m`;
const eligibility = (row: GratuityRegisterRow) => !row.coveredEmployment ? "Not applicable" : !row.available ? "Unavailable" : row.eligible ? "Eligible" : "Not yet eligible";

export function GratuityRegisterPdfDocument({ rows, logoSrc, asOfDate, filters }: { rows: GratuityRegisterRow[]; logoSrc: string; asOfDate: string; filters: { search: string; status: string; eligibility: string } }) {
  const eligibleRows = rows.filter((row) => row.eligible);
  const accrued = rows.reduce((sum, row) => sum + row.estimatedGratuity, 0);
  const payable = rows.reduce((sum, row) => sum + row.currentlyPayableEstimate, 0);
  return <Document title={`Gratuity Liability Register ${asOfDate}`} author="Despacho India Private Limited">
    <Page size="A4" orientation="landscape" style={styles.page}>
      <View style={styles.header} fixed>
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <Image src={logoSrc} style={styles.logo} />
        <View style={styles.titleBlock}>
          <Text style={styles.eyebrow}>PAYROLL ADMINISTRATION</Text>
          <Text style={styles.title}>Gratuity Liability Register</Text>
          <Text style={styles.subtitle}>Estimated as of {date(asOfDate)}</Text>
        </View>
      </View>
      <View style={styles.divider} fixed />
      <View style={styles.summary}>
        <View style={styles.summaryCard}><Text style={styles.summaryLabel}>EMPLOYEES</Text><Text style={styles.summaryValue}>{rows.length}</Text></View>
        <View style={styles.summaryCard}><Text style={styles.summaryLabel}>ELIGIBLE</Text><Text style={styles.summaryValue}>{eligibleRows.length}</Text></View>
        <View style={styles.summaryCard}><Text style={styles.summaryLabel}>ESTIMATED ACCRUED</Text><Text style={styles.summaryValue}>₹ {amount(accrued)}</Text></View>
        <View style={styles.summaryCard}><Text style={styles.summaryLabel}>CURRENTLY PAYABLE ESTIMATE</Text><Text style={styles.summaryValue}>₹ {amount(payable)}</Text></View>
      </View>
      <Text style={styles.context}>Filters: {filters.search || "All employees"} · Status: {filters.status === "all" ? "All" : filters.status} · Eligibility: {filters.eligibility === "all" ? "All" : filters.eligibility.replace("_", " ")}</Text>
      <View style={styles.table}>
        <View style={[styles.row, styles.headerRow]} fixed>
          <Text style={[styles.headerCell, styles.code]}>CODE</Text><Text style={[styles.headerCell, styles.name]}>EMPLOYEE</Text><Text style={[styles.headerCell, styles.joining]}>JOINING DATE</Text><Text style={[styles.headerCell, styles.tenure]}>TENURE</Text><Text style={[styles.headerCell, styles.status]}>STATUS</Text><Text style={[styles.headerCell, styles.basic]}>BASIC SALARY</Text><Text style={[styles.headerCell, styles.eligibility]}>ELIGIBILITY</Text><Text style={[styles.headerCell, styles.amount]}>EST. GRATUITY</Text>
        </View>
        {rows.map((row, index) => <View key={row.employeeId} wrap={false} style={[styles.row, index % 2 ? styles.alternate : {}]}>
          <Text style={[styles.cell, styles.code, styles.bold]}>{row.employeeCode}</Text><Text style={[styles.cell, styles.name, styles.bold]}>{row.employeeName}</Text><Text style={[styles.cell, styles.joining]}>{date(row.dateOfJoining)}</Text><Text style={[styles.cell, styles.tenure]}>{tenure(row)}</Text><Text style={[styles.cell, styles.status]}>{row.employeeStatus}</Text><Text style={[styles.cell, styles.basic]}>{row.available ? amount(row.basicSalary) : "-"}</Text><Text style={[styles.cell, styles.eligibility]}>{eligibility(row)}</Text><Text style={[styles.cell, styles.amount, styles.amountText]}>{row.available && row.coveredEmployment ? amount(row.estimatedGratuity) : "-"}</Text>
        </View>)}
      </View>
      <View style={styles.footer} fixed><Text style={styles.footerText}>Informational estimate only. Actual gratuity depends on applicable law, continuous service, employment classification and settlement date.</Text><Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} /></View>
    </Page>
  </Document>;
}

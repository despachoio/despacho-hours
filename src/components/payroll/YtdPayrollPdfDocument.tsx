import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { PayrollEntry } from "@/lib/payroll/types";

const NAVY = "#0F2F66";
const BLUE = "#1457B8";
const PALE_BLUE = "#EEF5FF";
const BORDER = "#B8C7DA";
const TEXT = "#172033";

type YtdRow = {
  label: string;
  value: (entry: PayrollEntry) => number;
  tone?: "section" | "total" | "net";
};

const rows: YtdRow[] = [
  { label: "EARNINGS", value: () => 0, tone: "section" },
  { label: "Basic Pay", value: (entry) => entry.basic_pay },
  { label: "HRA", value: (entry) => entry.hra },
  { label: "Conveyance Allowance", value: (entry) => entry.conveyance_allowance },
  { label: "Other Allowance", value: (entry) => entry.other_allowance },
  { label: "Bonus", value: (entry) => entry.bonus },
  { label: "Leave Encashment", value: (entry) => entry.leave_encashment },
  { label: "Reimbursements", value: (entry) => entry.reimbursements },
  { label: "TOTAL EARNINGS", value: (entry) => entry.total_earnings, tone: "total" },
  { label: "DEDUCTIONS", value: () => 0, tone: "section" },
  { label: "Employee PF", value: (entry) => entry.employee_pf },
  { label: "Professional Tax", value: (entry) => entry.professional_tax },
  { label: "LOP Deduction", value: (entry) => entry.lop_deduction },
  { label: "Previous Month Adjustment", value: (entry) => entry.previous_month_adjustment },
  { label: "TDS", value: (entry) => entry.tds },
  { label: "TOTAL DEDUCTIONS", value: (entry) => entry.total_deductions, tone: "total" },
  { label: "NET PAY", value: (entry) => entry.net_salary, tone: "net" },
];

const styles = StyleSheet.create({
  page: { paddingHorizontal: 28, paddingTop: 24, paddingBottom: 28, fontFamily: "Helvetica", color: TEXT, backgroundColor: "#FFFFFF" },
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  logo: { width: 160, height: 46, objectFit: "contain", objectPosition: "left center" },
  titleBlock: { flex: 1, alignItems: "center", paddingTop: 2 },
  company: { fontSize: 13, fontWeight: "bold", color: NAVY, letterSpacing: 0.4 },
  title: { marginTop: 8, fontSize: 10, fontWeight: "bold", color: BLUE },
  year: { marginTop: 3, fontSize: 8, color: "#64748B" },
  employeeCard: { marginTop: 15, flexDirection: "row", justifyContent: "space-between", borderWidth: 1, borderColor: "#D7E2EF", borderRadius: 6, backgroundColor: "#F8FBFF", paddingHorizontal: 12, paddingVertical: 8 },
  employeeLabel: { fontSize: 6.5, color: "#718096", textTransform: "uppercase", letterSpacing: 0.6 },
  employeeValue: { marginTop: 2, fontSize: 8.5, fontWeight: "bold", color: NAVY },
  table: { marginTop: 14, borderWidth: 1, borderColor: BORDER, borderRadius: 4, overflow: "hidden" },
  row: { flexDirection: "row", minHeight: 19, borderBottomWidth: 0.6, borderBottomColor: "#DCE4EE" },
  lastRow: { borderBottomWidth: 0 },
  headerRow: { minHeight: 25, backgroundColor: NAVY },
  sectionRow: { minHeight: 18, backgroundColor: PALE_BLUE },
  totalRow: { minHeight: 21, backgroundColor: "#E8F1FC" },
  netRow: { minHeight: 23, backgroundColor: BLUE },
  itemCell: { width: 111, justifyContent: "center", paddingHorizontal: 7, borderRightWidth: 0.6, borderRightColor: BORDER },
  monthCell: { width: 50, justifyContent: "center", alignItems: "center", borderRightWidth: 0.6, borderRightColor: BORDER },
  grandCell: { flex: 1, justifyContent: "center", alignItems: "center" },
  headerText: { fontSize: 6.2, fontWeight: "bold", color: "#FFFFFF" },
  label: { fontSize: 6.6, color: TEXT },
  value: { fontSize: 6.3, color: TEXT },
  strong: { fontWeight: "bold", color: NAVY },
  netText: { fontWeight: "bold", color: "#FFFFFF" },
  footer: { position: "absolute", left: 28, right: 28, bottom: 16, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 0.7, borderTopColor: "#D7E2EF", paddingTop: 6 },
  footerText: { fontSize: 6.5, color: "#718096" },
});

function amount(value: number) {
  const rounded = Math.round(Number(value || 0));
  return rounded === 0 ? "-" : rounded.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function monthLabel(entry: PayrollEntry) {
  return new Date(`${entry.payroll_month.slice(0, 7)}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" });
}

export function YtdPayrollPdfDocument({ entries, year, logoSrc, companyName }: { entries: PayrollEntry[]; year: string; logoSrc: string; companyName: string }) {
  const ordered = [...entries].sort((left, right) => left.payroll_month.localeCompare(right.payroll_month));
  const employee = ordered[0];
  return (
    <Document title={`YTD Payroll ${employee?.employee_code || "Employee"} ${year}`} author={companyName}>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={logoSrc} style={styles.logo} />
          <View style={styles.titleBlock}>
            <Text style={styles.company}>{companyName.toUpperCase()}</Text>
            <Text style={styles.title}>YEAR-TO-DATE PAYROLL DETAILS</Text>
            <Text style={styles.year}>January - December {year}</Text>
          </View>
          <View style={{ width: 160 }} />
        </View>

        <View style={styles.employeeCard}>
          <View><Text style={styles.employeeLabel}>Employee</Text><Text style={styles.employeeValue}>{employee?.employee_name || "-"}</Text></View>
          <View><Text style={styles.employeeLabel}>Employee Code</Text><Text style={styles.employeeValue}>{employee?.employee_code || "-"}</Text></View>
          <View><Text style={styles.employeeLabel}>Department</Text><Text style={styles.employeeValue}>{employee?.department || "-"}</Text></View>
          <View><Text style={styles.employeeLabel}>Report Year</Text><Text style={styles.employeeValue}>{year}</Text></View>
        </View>

        <View style={styles.table}>
          <View style={[styles.row, styles.headerRow]}>
            <View style={styles.itemCell}><Text style={styles.headerText}>ITEM</Text></View>
            {ordered.map((entry) => <View key={entry.id} style={styles.monthCell}><Text style={styles.headerText}>{monthLabel(entry)}</Text></View>)}
            <View style={styles.grandCell}><Text style={styles.headerText}>GRAND TOTAL</Text></View>
          </View>
          {rows.map((row, index) => {
            const section = row.tone === "section";
            const total = row.tone === "total";
            const net = row.tone === "net";
            const rowStyle = [styles.row, section ? styles.sectionRow : {}, total ? styles.totalRow : {}, net ? styles.netRow : {}, index === rows.length - 1 ? styles.lastRow : {}];
            const textStyle = [styles.label, section || total ? styles.strong : {}, net ? styles.netText : {}];
            const valueStyle = [styles.value, total ? styles.strong : {}, net ? styles.netText : {}];
            const grandTotal = section ? 0 : ordered.reduce((sum, entry) => sum + Number(row.value(entry) || 0), 0);
            return (
              <View key={row.label} style={rowStyle}>
                <View style={styles.itemCell}><Text style={textStyle}>{row.label}</Text></View>
                {ordered.map((entry) => <View key={entry.id} style={styles.monthCell}><Text style={valueStyle}>{section ? "" : amount(row.value(entry))}</Text></View>)}
                <View style={styles.grandCell}><Text style={valueStyle}>{section ? "" : amount(grandTotal)}</Text></View>
              </View>
            );
          })}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>System-generated YTD payroll statement. No signature is required.</Text>
          <Text style={styles.footerText}>All amounts are in INR</Text>
        </View>
      </Page>
    </Document>
  );
}

import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { PdfIcon, RupeeNotice, formatDate, type PayrollPdfIconName } from "@/components/payroll/PayslipPdfDocument";
import { financialYearFromValue } from "@/lib/payroll/financialYear";
import type { PayrollEntry } from "@/lib/payroll/types";

const PRIMARY = "#153E90";
const PRIMARY_DARK = "#082E68";
const SLATE = "#172033";
const BORDER = "#C9D5E5";

export type YtdPayrollEmployeeDetails = {
  employeeName: string;
  designation: string | null;
  dateOfJoining: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  pfNumber: string | null;
  uan: string | null;
  panNumber: string | null;
};

type YtdRow = {
  label: string;
  value: (entry: PayrollEntry) => number;
  tone?: "earnings" | "earningsTotal" | "deductions" | "deductionsTotal" | "net";
};

const rows: YtdRow[] = [
  { label: "EARNINGS", value: () => 0, tone: "earnings" },
  { label: "Basic Pay", value: (entry) => entry.basic_pay },
  { label: "HRA", value: (entry) => entry.hra },
  { label: "Conveyance Allowance", value: (entry) => entry.conveyance_allowance },
  { label: "Other Allowance", value: (entry) => entry.other_allowance },
  { label: "Bonus", value: (entry) => entry.bonus },
  { label: "Leave Encashment", value: (entry) => entry.leave_encashment },
  { label: "Reimbursements", value: (entry) => entry.reimbursements },
  { label: "TOTAL EARNINGS", value: (entry) => entry.total_earnings, tone: "earningsTotal" },
  { label: "DEDUCTIONS", value: () => 0, tone: "deductions" },
  { label: "Employee PF", value: (entry) => entry.employee_pf },
  { label: "Professional Tax", value: (entry) => entry.professional_tax },
  { label: "LOP Deduction", value: (entry) => entry.lop_deduction },
  { label: "Previous Month Adjustment", value: (entry) => entry.previous_month_adjustment },
  { label: "TDS", value: (entry) => entry.tds },
  { label: "TOTAL DEDUCTIONS", value: (entry) => entry.total_deductions, tone: "deductionsTotal" },
  { label: "NET PAY", value: (entry) => entry.net_salary, tone: "net" },
];

const styles = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 18, fontFamily: "Helvetica", color: SLATE, backgroundColor: "#FFFFFF" },
  header: { flexDirection: "row", alignItems: "flex-start", minHeight: 51 },
  brand: { width: 190 },
  logo: { width: 174, height: 45, objectFit: "contain", objectPosition: "left center" },
  titleBlock: { flex: 1, alignItems: "center", paddingTop: 2 },
  company: { fontSize: 17, fontWeight: "bold", color: PRIMARY, letterSpacing: 0.35 },
  title: { marginTop: 7, fontSize: 11.5, fontWeight: "bold", color: "#64748B" },
  headerSpacer: { width: 190 },
  headerDivider: { height: 1.4, marginTop: 5, backgroundColor: PRIMARY_DARK },
  employeeShell: { marginTop: 9, borderRadius: 10, backgroundColor: "#EEF2F7", padding: 4, paddingBottom: 6 },
  employeeCard: { borderWidth: 0.8, borderColor: BORDER, borderRadius: 8, overflow: "hidden", backgroundColor: "#FFFFFF" },
  employeeHeading: { flexDirection: "row", alignItems: "center", minHeight: 25, paddingHorizontal: 12, backgroundColor: "#F4F8FD", borderBottomWidth: 0.6, borderBottomColor: "#DCE5F0" },
  employeeHeadingBadge: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "#E3EEFC", marginRight: 8 },
  employeeHeadingText: { fontSize: 10.5, fontWeight: "bold", color: PRIMARY_DARK },
  employeeColumns: { flexDirection: "row", paddingHorizontal: 12, paddingVertical: 4 },
  employeeColumn: { width: "50%", paddingRight: 13 },
  employeeColumnRight: { width: "50%", paddingLeft: 15, borderLeftWidth: 0.8, borderLeftColor: "#DCE5F0" },
  infoRow: { minHeight: 15.5, flexDirection: "row", alignItems: "center" },
  infoIcon: { width: 23, alignItems: "center", marginRight: 5 },
  infoLabel: { width: 90, fontSize: 7.2, fontWeight: "medium", color: "#475569" },
  infoColon: { width: 10, fontSize: 7.2, color: "#64748B", textAlign: "center" },
  infoValue: { flex: 1, fontSize: 7.7, fontWeight: "bold", color: SLATE },
  table: { marginTop: 9, borderWidth: 0.8, borderColor: BORDER, borderRadius: 7, overflow: "hidden" },
  row: { flexDirection: "row", minHeight: 15.5, borderBottomWidth: 0.45, borderBottomColor: "#DCE4EE" },
  alternateRow: { backgroundColor: "#F8FAFC" },
  lastRow: { borderBottomWidth: 0 },
  headerRow: { minHeight: 25, backgroundColor: "#0F172A" },
  earningsRow: { minHeight: 18, backgroundColor: "#EAF3FF" },
  earningsTotalRow: { minHeight: 19, backgroundColor: "#315A8F" },
  deductionsRow: { minHeight: 18, backgroundColor: "#FFF1F2" },
  deductionsTotalRow: { minHeight: 19, backgroundColor: "#52667F" },
  netRow: { minHeight: 23, backgroundColor: PRIMARY },
  itemCell: { width: 116, justifyContent: "center", paddingHorizontal: 8, borderRightWidth: 0.5, borderRightColor: BORDER },
  monthCell: { width: 51, justifyContent: "center", alignItems: "flex-end", paddingHorizontal: 4, borderRightWidth: 0.5, borderRightColor: BORDER },
  monthHeaderCell: { width: 51, justifyContent: "center", alignItems: "center", borderRightWidth: 0.5, borderRightColor: "#4D6079" },
  grandCell: { width: 73, justifyContent: "center", alignItems: "flex-end", paddingHorizontal: 6, borderLeftWidth: 1, borderLeftColor: "#7692B5" },
  grandHeaderCell: { width: 73, justifyContent: "center", alignItems: "center", backgroundColor: "#062657", borderLeftWidth: 1, borderLeftColor: "#7692B5" },
  headerText: { fontSize: 6.4, fontWeight: "bold", color: "#FFFFFF", textAlign: "center" },
  label: { fontSize: 6.8, color: SLATE },
  value: { fontSize: 6.5, color: SLATE, textAlign: "right" },
  sectionText: { fontSize: 7.4, fontWeight: "bold", color: PRIMARY_DARK },
  deductionSectionText: { fontSize: 7.4, fontWeight: "bold", color: "#8B2635" },
  whiteText: { fontWeight: "bold", color: "#FFFFFF" },
  netText: { fontSize: 8.1, fontWeight: "bold", color: "#FFFFFF" },
  currencyRow: { position: "absolute", left: 20, right: 20, bottom: 43, minHeight: 33, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  footer: { position: "absolute", left: 20, right: 20, bottom: 14, minHeight: 32, flexDirection: "row", alignItems: "center", borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 7 },
  footerBadge: { width: 25, height: 25, borderRadius: 12.5, alignItems: "center", justifyContent: "center", backgroundColor: "#E8F3FF", marginRight: 9 },
  footerText: { fontSize: 7.8, color: "#303846" },
});

function amount(value: number) {
  const rounded = Math.round(Number(value || 0));
  return rounded === 0 ? "-" : rounded.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function monthLabel(month: string) {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" });
}

function ExecutiveInfoRow({ icon, label, value }: { icon: PayrollPdfIconName; label: string; value: string | null }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}><PdfIcon name={icon} size={16} /></View>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoColon}>:</Text>
      <Text style={styles.infoValue}>{value || "-"}</Text>
    </View>
  );
}

export function YtdPayrollPdfDocument({ entries, financialYear: financialYearValue, logoSrc, employee }: { entries: PayrollEntry[]; financialYear: string; logoSrc: string; employee: YtdPayrollEmployeeDetails }) {
  const financialYear = financialYearFromValue(financialYearValue);
  if (!financialYear) throw new Error("Invalid financial year");
  const includedEntries = entries.filter((entry) => financialYear.months.includes(entry.payroll_month.slice(0, 7)));
  const entryByMonth = new Map(includedEntries.map((entry) => [entry.payroll_month.slice(0, 7), entry]));
  const employeeCode = includedEntries[0]?.employee_code || "Employee";
  let alternatingIndex = 0;
  return (
    <Document title={`YTD Payroll ${employeeCode} ${financialYear.value}`} author="Despacho India Private Limited">
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.brand}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={logoSrc} style={styles.logo} />
          </View>
          <View style={styles.titleBlock}>
            <Text style={styles.company}>DESPACHO INDIA PRIVATE LIMITED</Text>
            <Text style={styles.title}>YTD Summary for the Financial Year {financialYear.label}</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.headerDivider} />

        <View style={styles.employeeShell}>
          <View style={styles.employeeCard}>
            <View style={styles.employeeHeading}>
              <View style={styles.employeeHeadingBadge}><PdfIcon name="user" size={17} /></View>
              <Text style={styles.employeeHeadingText}>EMPLOYEE INFORMATION</Text>
            </View>
            <View style={styles.employeeColumns}>
              <View style={styles.employeeColumn}>
                <ExecutiveInfoRow icon="id" label="Employee Code" value={employeeCode} />
                <ExecutiveInfoRow icon="user" label="Employee Name" value={employee.employeeName} />
                <ExecutiveInfoRow icon="briefcase" label="Designation" value={employee.designation} />
                <ExecutiveInfoRow icon="calendar" label="Date of Joining" value={formatDate(employee.dateOfJoining)} />
              </View>
              <View style={styles.employeeColumnRight}>
                <ExecutiveInfoRow icon="bank" label="Bank Name" value={employee.bankName} />
                <ExecutiveInfoRow icon="card" label="Bank Account No" value={employee.bankAccountNumber} />
                <ExecutiveInfoRow icon="shield" label="PF No" value={employee.pfNumber} />
                <ExecutiveInfoRow icon="user" label="UAN" value={employee.uan} />
                <ExecutiveInfoRow icon="id" label="PAN No" value={employee.panNumber} />
              </View>
            </View>
          </View>
        </View>

        <View style={styles.table}>
          <View style={[styles.row, styles.headerRow]}>
            <View style={styles.itemCell}><Text style={styles.headerText}>ITEM</Text></View>
            {financialYear.months.map((month) => <View key={month} style={styles.monthHeaderCell}><Text style={styles.headerText}>{monthLabel(month)}</Text></View>)}
            <View style={styles.grandHeaderCell}><Text style={styles.headerText}>GRAND TOTAL</Text></View>
          </View>
          {rows.map((row, index) => {
            const section = row.tone === "earnings" || row.tone === "deductions";
            const total = row.tone === "earningsTotal" || row.tone === "deductionsTotal";
            const net = row.tone === "net";
            const alternate = !row.tone && alternatingIndex++ % 2 === 1;
            const rowStyle = [styles.row, alternate ? styles.alternateRow : {}, row.tone === "earnings" ? styles.earningsRow : {}, row.tone === "earningsTotal" ? styles.earningsTotalRow : {}, row.tone === "deductions" ? styles.deductionsRow : {}, row.tone === "deductionsTotal" ? styles.deductionsTotalRow : {}, net ? styles.netRow : {}, index === rows.length - 1 ? styles.lastRow : {}];
            const textStyle = [styles.label, row.tone === "earnings" ? styles.sectionText : {}, row.tone === "deductions" ? styles.deductionSectionText : {}, total ? styles.whiteText : {}, net ? styles.netText : {}];
            const valueStyle = [styles.value, total ? styles.whiteText : {}, net ? styles.netText : {}];
            const grandTotal = section ? 0 : includedEntries.reduce((sum, entry) => sum + Number(row.value(entry) || 0), 0);
            return (
              <View key={row.label} style={rowStyle}>
                <View style={styles.itemCell}><Text style={textStyle}>{row.label}</Text></View>
                {financialYear.months.map((month) => {
                  const entry = entryByMonth.get(month);
                  return <View key={month} style={styles.monthCell}><Text style={valueStyle}>{section || !entry ? "" : amount(row.value(entry))}</Text></View>;
                })}
                <View style={styles.grandCell}><Text style={valueStyle}>{section ? "" : amount(grandTotal)}</Text></View>
              </View>
            );
          })}
        </View>

        <View style={styles.currencyRow}>
          <RupeeNotice text="All amounts are in Indian Rupees (INR)" />
        </View>

        <View style={styles.footer}>
          <View style={styles.footerBadge}><PdfIcon name="file" size={15} /></View>
          <Text style={styles.footerText}>System-generated YTD payroll statement. No signature is required.</Text>
        </View>
      </Page>
    </Document>
  );
}

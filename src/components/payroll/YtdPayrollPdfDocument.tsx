import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { EmployeeInfoRow, PdfIcon, RupeeNotice, formatDate } from "@/components/payroll/PayslipPdfDocument";
import { financialYearFromValue } from "@/lib/payroll/financialYear";
import type { PayrollEntry } from "@/lib/payroll/types";

const PRIMARY = "#153E90";
const PRIMARY_DARK = "#07316F";
const SLATE = "#111827";
const BORDER = "#D7DEE8";

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
  page: { paddingHorizontal: 24, paddingTop: 22, paddingBottom: 66, fontFamily: "Helvetica", color: SLATE, backgroundColor: "#FFFFFF" },
  header: { flexDirection: "row", alignItems: "flex-start", minHeight: 58 },
  brand: { width: 180 },
  logo: { width: 164, height: 48, objectFit: "contain", objectPosition: "left center" },
  titleBlock: { flex: 1, alignItems: "flex-end", paddingTop: 2 },
  company: { fontSize: 16, fontWeight: "bold", color: PRIMARY, letterSpacing: 0.25 },
  title: { marginTop: 7, fontSize: 10.5, fontWeight: "bold", color: "#64748B" },
  employeeCard: { marginTop: 12, borderWidth: 1, borderColor: BORDER, borderRadius: 8, overflow: "hidden", backgroundColor: "#FFFFFF" },
  employeeHeading: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingTop: 9, paddingBottom: 6, backgroundColor: "#F8FBFF" },
  employeeHeadingBadge: { width: 25, height: 25, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#E8F3FF", marginRight: 8 },
  employeeHeadingText: { fontSize: 11, fontWeight: "bold", color: PRIMARY_DARK },
  employeeColumns: { flexDirection: "row", paddingHorizontal: 14, paddingBottom: 8 },
  employeeColumn: { width: "50%", paddingRight: 12 },
  employeeColumnRight: { width: "50%", paddingLeft: 15, borderLeftWidth: 1, borderLeftColor: BORDER },
  table: { marginTop: 13, borderWidth: 1, borderColor: "#C6D3E3", borderRadius: 6, overflow: "hidden" },
  row: { flexDirection: "row", minHeight: 18, borderBottomWidth: 0.55, borderBottomColor: "#DCE4EE" },
  lastRow: { borderBottomWidth: 0 },
  headerRow: { minHeight: 25, backgroundColor: "#0F172A" },
  earningsRow: { minHeight: 20, backgroundColor: "#EEF5FF" },
  earningsTotalRow: { minHeight: 21, backgroundColor: "#315A8F" },
  deductionsRow: { minHeight: 20, backgroundColor: "#FFF4F4" },
  deductionsTotalRow: { minHeight: 21, backgroundColor: "#52667F" },
  netRow: { minHeight: 24, backgroundColor: PRIMARY },
  itemCell: { width: 91, justifyContent: "center", paddingHorizontal: 6, borderRightWidth: 0.55, borderRightColor: "#C6D3E3" },
  monthCell: { width: 34, justifyContent: "center", alignItems: "flex-end", paddingRight: 3, borderRightWidth: 0.55, borderRightColor: "#C6D3E3" },
  monthHeaderCell: { width: 34, justifyContent: "center", alignItems: "center", borderRightWidth: 0.55, borderRightColor: "#53647C" },
  grandCell: { width: 48, justifyContent: "center", alignItems: "flex-end", paddingRight: 4 },
  grandHeaderCell: { width: 48, justifyContent: "center", alignItems: "center" },
  headerText: { fontSize: 4.7, fontWeight: "bold", color: "#FFFFFF", textAlign: "center" },
  label: { fontSize: 5.7, color: SLATE },
  value: { fontSize: 5.15, color: SLATE, textAlign: "right" },
  sectionText: { fontWeight: "bold", color: PRIMARY_DARK },
  whiteText: { fontWeight: "bold", color: "#FFFFFF" },
  netText: { fontSize: 6, fontWeight: "bold", color: "#FFFFFF" },
  currencyRow: { minHeight: 35, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  infoCircle: { width: 16, height: 16, borderWidth: 1, borderColor: PRIMARY_DARK, borderRadius: 8, alignItems: "center", justifyContent: "center", marginRight: 2 },
  infoText: { fontSize: 8, fontWeight: "bold", color: PRIMARY_DARK },
  footer: { position: "absolute", left: 24, right: 24, bottom: 18, minHeight: 32, flexDirection: "row", alignItems: "center", borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 8 },
  footerBadge: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#E8F3FF", marginRight: 9 },
  footerText: { fontSize: 8, color: "#303846" },
});

function amount(value: number) {
  const rounded = Math.round(Number(value || 0));
  return rounded === 0 ? "-" : rounded.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function monthLabel(month: string) {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" });
}

export function YtdPayrollPdfDocument({ entries, financialYear: financialYearValue, logoSrc, employee }: { entries: PayrollEntry[]; financialYear: string; logoSrc: string; employee: YtdPayrollEmployeeDetails }) {
  const financialYear = financialYearFromValue(financialYearValue);
  if (!financialYear) throw new Error("Invalid financial year");
  const includedEntries = entries.filter((entry) => financialYear.months.includes(entry.payroll_month.slice(0, 7)));
  const entryByMonth = new Map(includedEntries.map((entry) => [entry.payroll_month.slice(0, 7), entry]));
  const employeeCode = includedEntries[0]?.employee_code || "Employee";
  return (
    <Document title={`YTD Payroll ${employeeCode} ${financialYear.value}`} author="Despacho India Private Limited">
      <Page size="A4" orientation="portrait" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.brand}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={logoSrc} style={styles.logo} />
          </View>
          <View style={styles.titleBlock}>
            <Text style={styles.company}>DESPACHO INDIA PRIVATE LIMITED</Text>
            <Text style={styles.title}>YTD Summary for the Year {financialYear.startYear} - {financialYear.endYear}</Text>
          </View>
        </View>

        <View style={styles.employeeCard}>
          <View style={styles.employeeHeading}>
            <View style={styles.employeeHeadingBadge}><PdfIcon name="user" size={15} /></View>
            <Text style={styles.employeeHeadingText}>EMPLOYEE INFORMATION</Text>
          </View>
          <View style={styles.employeeColumns}>
            <View style={styles.employeeColumn}>
              <EmployeeInfoRow icon="id" label="Employee Code" value={employeeCode} />
              <EmployeeInfoRow icon="user" label="Employee Name" value={employee.employeeName} />
              <EmployeeInfoRow icon="briefcase" label="Designation" value={employee.designation} />
              <EmployeeInfoRow icon="calendar" label="Date of Joining" value={formatDate(employee.dateOfJoining)} />
            </View>
            <View style={styles.employeeColumnRight}>
              <EmployeeInfoRow icon="bank" label="Bank Name" value={employee.bankName} />
              <EmployeeInfoRow icon="card" label="Bank Account No" value={employee.bankAccountNumber} />
              <EmployeeInfoRow icon="shield" label="PF No" value={employee.pfNumber} />
              <EmployeeInfoRow icon="user" label="UAN" value={employee.uan} />
              <EmployeeInfoRow icon="id" label="PAN No" value={employee.panNumber} />
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
            const rowStyle = [styles.row, row.tone === "earnings" ? styles.earningsRow : {}, row.tone === "earningsTotal" ? styles.earningsTotalRow : {}, row.tone === "deductions" ? styles.deductionsRow : {}, row.tone === "deductionsTotal" ? styles.deductionsTotalRow : {}, net ? styles.netRow : {}, index === rows.length - 1 ? styles.lastRow : {}];
            const textStyle = [styles.label, section ? styles.sectionText : {}, total ? styles.whiteText : {}, net ? styles.netText : {}];
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
          <View style={styles.infoCircle}><Text style={styles.infoText}>i</Text></View>
          <RupeeNotice />
        </View>

        <View style={styles.footer}>
          <View style={styles.footerBadge}><PdfIcon name="file" size={14} /></View>
          <Text style={styles.footerText}>System-generated YTD payroll statement. No signature is required.</Text>
        </View>
      </Page>
    </Document>
  );
}

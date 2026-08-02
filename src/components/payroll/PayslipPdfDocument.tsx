import { Circle, Document, Image, Page, Path, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import type { PayrollEntry } from "@/lib/payroll/types";

export type PayslipEmployeeDetails = {
  employeeName: string;
  designation: string | null;
  effectiveWorkingDays: number;
  dateOfJoining: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  pfNumber: string | null;
  uan: string | null;
  panNumber: string | null;
};

type AmountRow = { label: string; value: number };

const PRIMARY = "#153E90";
const SLATE = "#0F172A";
const MUTED = "#64748B";
const BORDER = "#E2E8F0";
const SURFACE = "#F8FAFC";

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: 38,
    paddingTop: 34,
    paddingBottom: 48,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: SLATE,
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 18,
    borderBottomWidth: 2,
    borderBottomColor: PRIMARY,
  },
  logo: { width: 152, height: 46, objectFit: "contain", objectPosition: "left center" },
  headingBlock: { alignItems: "flex-end" },
  title: { fontSize: 23, fontWeight: "bold", color: PRIMARY, letterSpacing: 0.7 },
  month: { marginTop: 5, fontSize: 10, color: MUTED },
  section: { marginTop: 18 },
  sectionHeading: {
    marginBottom: 8,
    fontSize: 9,
    fontWeight: "bold",
    color: PRIMARY,
    letterSpacing: 1.2,
  },
  employeeCard: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 9,
    backgroundColor: "#FFFFFF",
    paddingVertical: 13,
    paddingHorizontal: 15,
  },
  employeeColumn: { width: "50%", paddingRight: 12 },
  employeeColumnRight: { width: "50%", paddingLeft: 15, borderLeftWidth: 1, borderLeftColor: BORDER },
  infoRow: { flexDirection: "row", minHeight: 19, alignItems: "center" },
  infoLabel: { width: 88, fontSize: 7.5, color: MUTED },
  infoValue: { flex: 1, fontSize: 8.5, fontWeight: "bold", color: SLATE },
  tables: { flexDirection: "row" },
  tableCard: {
    width: "48.5%",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 9,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
  },
  tableCardRight: { marginLeft: "3%" },
  tableHeader: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    backgroundColor: SURFACE,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    fontSize: 9,
    fontWeight: "bold",
    color: PRIMARY,
  },
  moneyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 27,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EDF2F7",
  },
  moneyLabel: { width: "68%", color: "#334155" },
  moneyValue: { width: "32%", textAlign: "right", fontWeight: "bold", color: SLATE },
  emptyRow: { minHeight: 27, paddingHorizontal: 12, paddingVertical: 9, color: MUTED },
  tableTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: SURFACE,
  },
  tableTotalLabel: { fontWeight: "bold", color: "#334155" },
  tableTotalValue: { fontWeight: "bold", color: PRIMARY, textAlign: "right" },
  summary: {
    marginTop: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 9,
    backgroundColor: SURFACE,
    flexDirection: "row",
    alignItems: "stretch",
  },
  summaryItem: { width: "31%", paddingHorizontal: 10, justifyContent: "center" },
  summaryDivider: { borderLeftWidth: 1, borderLeftColor: BORDER },
  summaryLabel: { fontSize: 7.5, color: MUTED, marginBottom: 5 },
  summaryValue: { fontSize: 13, fontWeight: "bold", color: SLATE },
  netItem: {
    width: "38%",
    paddingVertical: 10,
    paddingHorizontal: 13,
    backgroundColor: PRIMARY,
    borderRadius: 7,
  },
  netLabel: { fontSize: 7.5, color: "#DBEAFE", marginBottom: 5 },
  netValue: { fontSize: 17, fontWeight: "bold", color: "#FFFFFF" },
  footer: {
    position: "absolute",
    left: 38,
    right: 38,
    bottom: 25,
    paddingTop: 9,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    alignItems: "center",
  },
  currencyNotice: { flexDirection: "row", alignItems: "center", marginBottom: 7 },
  currencyIcon: { marginRight: 6 },
  currencyText: { color: "#64748B", fontSize: 7.5 },
  footerText: { color: "#94A3B8", fontSize: 7, textAlign: "center" },
});

export function formatCurrency(value: number) {
  return Math.round(Number(value || 0)).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function formatMonth(value: string) {
  return new Date(`${value.slice(0, 7)}-01T00:00:00Z`).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatDays(value: number) {
  return Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function EmployeeInfoRow({ label, value }: { label: string; value: string | number | null }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value === null || value === "" ? "—" : String(value)}</Text>
    </View>
  );
}

function MoneyRow({ label, value }: AmountRow) {
  return (
    <View style={styles.moneyRow}>
      <Text style={styles.moneyLabel}>{label}</Text>
      <Text style={styles.moneyValue}>{formatCurrency(value)}</Text>
    </View>
  );
}

function PayrollTable({ title, rows, totalLabel, total, right = false }: { title: string; rows: AmountRow[]; totalLabel: string; total: number; right?: boolean }) {
  return (
    <View style={right ? [styles.tableCard, styles.tableCardRight] : styles.tableCard}>
      <Text style={styles.tableHeader}>{title}</Text>
      {rows.length ? rows.map((row) => <MoneyRow key={row.label} {...row} />) : <Text style={styles.emptyRow}>No deductions</Text>}
      <View style={styles.tableTotal}>
        <Text style={styles.tableTotalLabel}>{totalLabel}</Text>
        <Text style={styles.tableTotalValue}>{formatCurrency(total)}</Text>
      </View>
    </View>
  );
}

function SummaryItem({ label, value, divider = false }: { label: string; value: number; divider?: boolean }) {
  return (
    <View style={divider ? [styles.summaryItem, styles.summaryDivider] : styles.summaryItem}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{formatCurrency(value)}</Text>
    </View>
  );
}

export function PayslipPdfDocument({
  entry,
  logoSrc,
  companyName,
  employee,
}: {
  entry: PayrollEntry;
  logoSrc: string;
  companyName: string;
  employee: PayslipEmployeeDetails;
}) {
  const earnings: AmountRow[] = [
    { label: "Basic Pay", value: entry.basic_pay },
    { label: "HRA", value: entry.hra },
    { label: "Conveyance Allowance", value: entry.conveyance_allowance },
    { label: "Other Allowance", value: entry.other_allowance },
    { label: "Bonus", value: entry.bonus },
    { label: "Leave Encashment", value: entry.leave_encashment },
    { label: "Reimbursements", value: entry.reimbursements },
  ].filter((item) => Number(item.value) > 0);

  const deductions: AmountRow[] = [
    { label: "Employee PF", value: entry.employee_pf },
    { label: "Professional Tax", value: entry.professional_tax },
    { label: "LOP Deduction", value: entry.lop_deduction },
    { label: "Previous Month Adjustment", value: entry.previous_month_adjustment },
    { label: "TDS", value: entry.tds },
  ].filter((item) => Number(item.value) > 0);

  return (
    <Document title={`Payslip ${entry.employee_code} ${entry.payroll_month}`} author={companyName}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={logoSrc} style={styles.logo} />
          <View style={styles.headingBlock}>
            <Text style={styles.title}>PAYSLIP</Text>
            <Text style={styles.month}>{formatMonth(entry.payroll_month)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeading}>EMPLOYEE INFORMATION</Text>
          <View style={styles.employeeCard}>
            <View style={styles.employeeColumn}>
              <EmployeeInfoRow label="Employee Name" value={employee.employeeName} />
              <EmployeeInfoRow label="Employee Code" value={entry.employee_code} />
              <EmployeeInfoRow label="Designation" value={employee.designation} />
              <EmployeeInfoRow label="Effective Working Days" value={formatDays(employee.effectiveWorkingDays)} />
              <EmployeeInfoRow label="LOP" value={formatDays(entry.lop_days)} />
            </View>
            <View style={styles.employeeColumnRight}>
              <EmployeeInfoRow label="Date of Joining" value={formatDate(employee.dateOfJoining)} />
              <EmployeeInfoRow label="Bank Name" value={employee.bankName} />
              <EmployeeInfoRow label="Bank Account No" value={employee.bankAccountNumber} />
              <EmployeeInfoRow label="PF No" value={employee.pfNumber} />
              <EmployeeInfoRow label="UAN" value={employee.uan} />
              <EmployeeInfoRow label="PAN No" value={employee.panNumber} />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeading}>EARNINGS &amp; DEDUCTIONS</Text>
          <View style={styles.tables}>
            <PayrollTable title="Earnings" rows={earnings} totalLabel="Gross Earnings" total={entry.total_earnings} />
            <PayrollTable title="Deductions" rows={deductions} totalLabel="Total Deductions" total={entry.total_deductions} right />
          </View>
        </View>

        <View style={styles.summary}>
          <SummaryItem label="Gross Earnings" value={entry.total_earnings} />
          <SummaryItem label="Total Deductions" value={entry.total_deductions} divider />
          <View style={styles.netItem}>
            <Text style={styles.netLabel}>Net Salary</Text>
            <Text style={styles.netValue}>{formatCurrency(entry.net_salary)}</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <View style={styles.currencyNotice}>
            <Svg width={14} height={14} viewBox="0 0 14 14" style={styles.currencyIcon}>
              <Circle cx="7" cy="7" r="6.25" fill="none" stroke={PRIMARY} strokeWidth={0.8} />
              <Path
                d="M4 4.1h6M4 5.65h6M4 4.1h2.05c1.55 0 2.45.68 2.45 1.72 0 1.16-.93 1.86-2.55 1.86H4.4L8.65 11"
                fill="none"
                stroke={PRIMARY}
                strokeWidth={0.75}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
            <Text style={styles.currencyText}>All amounts are in INR</Text>
          </View>
          <Text style={styles.footerText}>System-generated payslip. No signature is required.</Text>
        </View>
      </Page>
    </Document>
  );
}

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
export type PayrollPdfIconName = "user" | "id" | "briefcase" | "calendar" | "clock" | "bank" | "card" | "shield" | "wallet" | "file";

const PRIMARY = "#153E90";
const PRIMARY_DARK = "#07316F";
const SLATE = "#111827";
const BORDER = "#D7DEE8";
const LIGHT_BLUE = "#F4F8FD";
const ICON_BLUE = "#E8F3FF";

const iconPaths: Record<PayrollPdfIconName, string> = {
  user: "M4 21c0-4 3.2-7 8-7s8 3 8 7M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9",
  id: "M3 5h18v15H3zM8 5V3h8v2M7 10a2 2 0 1 0 0-4M5 15c.4-2 1.5-3 3-3s2.6 1 3 3M14 10h4M14 14h4",
  briefcase: "M3 8h18v12H3zM8 8V5h8v3M3 12h18M10 12v2h4v-2",
  calendar: "M4 5h16v16H4zM8 3v4M16 3v4M4 9h16M8 13h1M12 13h1M16 13h1M8 17h1M12 17h1M16 17h1",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M12 7v6l4 2",
  bank: "M3 9h18L12 3 3 9zM5 10v8M9 10v8M15 10v8M19 10v8M3 19h18M2 22h20",
  card: "M3 6h18v13H3zM3 10h18M7 15h4",
  shield: "M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11zM8 12l2.5 2.5L16 9",
  wallet: "M3 7h17v13H3zM3 7l14-3v3M15 12h7v5h-7zM18 14.5h1",
  file: "M6 3h8l4 4v14H6zM14 3v5h5M9 12h6M9 15h6M9 18h4",
};

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 68,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: SLATE,
    backgroundColor: "#FFFFFF",
  },
  header: {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  minHeight: 62,
},
  brand: { width: 176.25 },
  logo: { width: 138, height: 39, objectFit: "contain", objectPosition: "left center" },
  brandTagline: { marginLeft: 40, marginTop: -3, fontSize: 8.5, color: "#9AA1AA", letterSpacing: 0.15 },
  headingBlock: {
  alignItems: "flex-end",
  justifyContent: "center",
  height: 42,
  paddingTop: 10,
  marginRight: 28,
},
  title: {
  fontSize: 12,
  fontWeight: "bold",
  color: "#153E90",
  letterSpacing: 0.6,
},

separator: {
  color: "#153E90",
  fontSize: 12,
},

monthInline: {
  color: "#64748B",
  fontSize: 12,
  fontWeight: "semibold",
  letterSpacing: 0.3,
},
  employeeCard: {
    marginTop: 13,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 7,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
  },
  employeeHeading: {
  flexDirection: "row",
  alignItems: "center",
  minHeight: 38,
  paddingHorizontal: 14,
  backgroundColor: LIGHT_BLUE,
  borderBottomWidth: 1,
  borderBottomColor: "#C9D8EA",
},

employeeHeadingBadge: {
  width: 28,
  height: 28,
  borderRadius: 14,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: ICON_BLUE,
  marginRight: 10,
},

employeeHeadingText: {
  fontSize: 11,
  fontWeight: "bold",
  color: PRIMARY_DARK,
  letterSpacing: 0.35,
},
  employeeColumns: { flexDirection: "row", paddingHorizontal: 14, paddingBottom: 10 },
  employeeColumn: { width: "50%", paddingRight: 12 },
  employeeColumnRight: { width: "50%", paddingLeft: 15, borderLeftWidth: 1, borderLeftColor: BORDER },
  infoRow: { flexDirection: "row", alignItems: "center", minHeight: 27 },
  infoIcon: { width: 22, alignItems: "center", marginRight: 6 },
  infoLabel: { width: 88, fontSize: 8, color: "#303846" },
  infoColon: { width: 12, fontSize: 8, color: "#303846", textAlign: "center" },
  infoValue: { flex: 1, fontSize: 8.4, fontWeight: "bold", color: SLATE },
  sectionHeading: { marginTop: 14, marginBottom: 9, flexDirection: "row", alignItems: "center" },
  sectionLine: { height: 1, flex: 1, backgroundColor: "#B9CAE1" },
  sectionHeadingText: { marginHorizontal: 16, fontSize: 11.5, fontWeight: "bold", color: PRIMARY_DARK },
  payrollCard: { borderWidth: 1, borderColor: "#C9D8EA", borderRadius: 7, overflow: "hidden" },
  payrollHeader: { flexDirection: "row", backgroundColor: LIGHT_BLUE, borderBottomWidth: 1, borderBottomColor: "#C9D8EA" },
  payrollHeaderCell: { width: "50%", minHeight: 35, flexDirection: "row", alignItems: "center", paddingHorizontal: 14 },
  payrollHeaderCellRight: { borderLeftWidth: 1, borderLeftColor: "#C9D8EA" },
  payrollHeaderBadge: { width: 25, height: 25, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: ICON_BLUE, marginRight: 8 },
  payrollHeaderText: { fontSize: 10.5, fontWeight: "bold", color: PRIMARY_DARK },
  payrollBody: { flexDirection: "row" },
  payrollColumn: { width: "50%", justifyContent: "space-between" },
  payrollColumnRight: { borderLeftWidth: 1, borderLeftColor: "#C9D8EA" },
  moneyRows: { paddingHorizontal: 16, paddingVertical: 6 },
  moneyRow: { minHeight: 23, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 0.6, borderBottomColor: "#E8EDF3" },
  blankMoneyRow: { minHeight: 23 },
  moneyLabel: { width: "68%", fontSize: 8.4, color: SLATE },
  moneyValue: { width: "32%", textAlign: "right", fontSize: 8.4, color: SLATE },
  tableTotal: { minHeight: 35, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, backgroundColor: LIGHT_BLUE, borderTopWidth: 1, borderTopColor: "#C9D8EA" },
  tableTotalLabel: { fontSize: 9.5, fontWeight: "bold", color: PRIMARY_DARK },
  tableTotalValue: { fontSize: 12, fontWeight: "bold", color: SLATE, textAlign: "right" },
 summary: {
  marginTop: 16,
  minHeight: 92,
  flexDirection: "row",
  alignItems: "stretch",
  backgroundColor: "#F8FAFC",
  borderWidth: 1,
  borderColor: "#D7E2EE",
  borderRadius: 12,
  overflow: "hidden",
},

summaryItem: {
  flex: 1,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "#FFFFFF",
  paddingVertical: 10,
},

summaryDivider: {
  borderLeftWidth: 1,
  borderLeftColor: "#E2E8F0",
},

summaryLabel: {
  fontSize: 9,
  fontWeight: "bold",
  color: "#64748B",
  textTransform: "uppercase",
  letterSpacing: 1,
  textAlign: "center",
},

summaryValue: {
  marginTop: 8,
  fontSize: 20,
  fontWeight: "bold",
  color: "#0F172A",
  textAlign: "center",
},

netPill: {
  width: "92%",
  height: 68,
  backgroundColor: "#153E90",
  borderRadius: 16,
  alignItems: "center",
  justifyContent: "center",
},

netLabel: {
  fontSize: 9,
  fontWeight: "bold",
  color: "#E8F1FF",
  letterSpacing: 1.3,
  textTransform: "uppercase",
},

netValue: {
  marginTop: 5,
  fontSize: 22,
  fontWeight: "bold",
  color: "#FFFFFF",
},
  currencyNotice: { minHeight: 33, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  currencyIcon: { marginRight: 8 },
  currencyText: { fontSize: 8.5, color: "#303846" },
  footer: { position: "absolute", left: 24, right: 24, bottom: 18, minHeight: 34, flexDirection: "row", alignItems: "center", borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 8 },
  footerBadge: { width: 25, height: 25, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: ICON_BLUE, marginRight: 9 },
  footerText: { fontSize: 8.2, color: "#303846" },
});

export function formatCurrency(value: number) {
  return Math.round(Number(value || 0)).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatMonth(value: string) {
  return new Date(`${value.slice(0, 7)}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" });
}

function formatDays(value: number) {
  return Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

export function PdfIcon({ name, size = 15, colour = PRIMARY }: { name: PayrollPdfIconName; size?: number; colour?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={iconPaths[name]} fill="none" stroke={colour} strokeWidth={1.65} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function EmployeeInfoRow({ icon, label, value }: { icon: PayrollPdfIconName; label: string; value: string | number | null }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}><PdfIcon name={icon} size={17} /></View>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoColon}>:</Text>
      <Text style={styles.infoValue}>{value === null || value === "" ? "—" : String(value)}</Text>
    </View>
  );
}

function MoneyRow({ row }: { row: AmountRow | null }) {
  if (!row) return <View style={styles.blankMoneyRow} />;
  return (
    <View style={styles.moneyRow}>
      <Text style={styles.moneyLabel}>{row.label}</Text>
      <Text style={styles.moneyValue}>{formatCurrency(row.value)}</Text>
    </View>
  );
}

function PayrollColumn({ rows, rowCount, totalLabel, total, right = false }: { rows: AmountRow[]; rowCount: number; totalLabel: string; total: number; right?: boolean }) {
  return (
    <View style={right ? [styles.payrollColumn, styles.payrollColumnRight] : styles.payrollColumn}>
      <View style={styles.moneyRows}>
        {Array.from({ length: rowCount }, (_, index) => <MoneyRow key={rows[index]?.label || `blank-${index}`} row={rows[index] || null} />)}
      </View>
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

export function RupeeNotice({ text = "All amounts are in Indian Rupees (INR)" }: { text?: string } = {}) {
  return (
    <View style={styles.currencyNotice}>
      <Svg width={22} height={22} viewBox="0 0 22 22" style={styles.currencyIcon}>
        <Circle cx="11" cy="11" r="9.6" fill="none" stroke={PRIMARY_DARK} strokeWidth={1} />
        <Path d="M7 7.2h8M7 9.4h8M7 7.2h2.9c2 0 3.2.9 3.2 2.35 0 1.55-1.3 2.5-3.45 2.5H7.6L13.4 17" fill="none" stroke={PRIMARY_DARK} strokeWidth={1.15} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
      <Text style={styles.currencyText}>{text}</Text>
    </View>
  );
}

export function PayslipPdfDocument({ entry, logoSrc, companyName, employee }: { entry: PayrollEntry; logoSrc: string; companyName: string; employee: PayslipEmployeeDetails }) {
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

  const rowCount = Math.max(earnings.length, deductions.length, 1);

  return (
    <Document title={`Payslip ${entry.employee_code} ${entry.payroll_month}`} author={companyName}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.brand}>
            {/* @react-pdf/renderer Image does not support the HTML alt prop. */}
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={logoSrc} style={styles.logo} />
            
          </View>
          <View style={styles.headingBlock}>
  <Text style={styles.title}>
    PAYSLIP
    <Text style={styles.separator}> • </Text>
    <Text style={styles.monthInline}>
      {formatMonth(entry.payroll_month).toUpperCase()}
    </Text>
  </Text>
</View>
        </View>

        <View style={styles.employeeCard}>
          <View style={styles.employeeHeading}>
            <View style={styles.employeeHeadingBadge}><PdfIcon name="user" size={15} /></View>
            <Text style={styles.employeeHeadingText}>EMPLOYEE INFORMATION</Text>
          </View>
          <View style={styles.employeeColumns}>
            <View style={styles.employeeColumn}>
              <EmployeeInfoRow icon="user" label="Employee Name" value={employee.employeeName} />
              <EmployeeInfoRow icon="id" label="Employee Code" value={entry.employee_code} />
              <EmployeeInfoRow icon="briefcase" label="Designation" value={employee.designation} />
              <EmployeeInfoRow icon="calendar" label="Effective Working Days" value={formatDays(employee.effectiveWorkingDays)} />
              <EmployeeInfoRow icon="clock" label="LOP" value={formatDays(entry.lop_days)} />
            </View>
            <View style={styles.employeeColumnRight}>
              <EmployeeInfoRow icon="calendar" label="Date of Joining" value={formatDate(employee.dateOfJoining)} />
              <EmployeeInfoRow icon="bank" label="Bank Name" value={employee.bankName} />
              <EmployeeInfoRow icon="card" label="Bank Account No" value={employee.bankAccountNumber} />
              <EmployeeInfoRow icon="shield" label="PF No" value={employee.pfNumber} />
              <EmployeeInfoRow icon="user" label="UAN" value={employee.uan} />
              <EmployeeInfoRow icon="id" label="PAN No" value={employee.panNumber} />
            </View>
          </View>
        </View>

        <View style={styles.sectionHeading}>
          <View style={styles.sectionLine} />
          <Text style={styles.sectionHeadingText}>EARNINGS &amp; DEDUCTIONS</Text>
          <View style={styles.sectionLine} />
        </View>

        <View style={styles.payrollCard}>
          <View style={styles.payrollHeader}>
            <View style={styles.payrollHeaderCell}>
              <View style={styles.payrollHeaderBadge}><PdfIcon name="wallet" size={15} /></View>
              <Text style={styles.payrollHeaderText}>EARNINGS</Text>
            </View>
            <View style={[styles.payrollHeaderCell, styles.payrollHeaderCellRight]}>
              <View style={styles.payrollHeaderBadge}><PdfIcon name="shield" size={15} /></View>
              <Text style={styles.payrollHeaderText}>DEDUCTIONS</Text>
            </View>
          </View>
          <View style={styles.payrollBody}>
            <PayrollColumn rows={earnings} rowCount={rowCount} totalLabel="Total Earnings" total={entry.total_earnings} />
            <PayrollColumn rows={deductions} rowCount={rowCount} totalLabel="Total Deductions" total={entry.total_deductions} right />
          </View>
        </View>

        <View style={styles.summary}>
          <SummaryItem label="GROSS SALARY" value={entry.total_earnings} />
          <SummaryItem label="TOTAL DEDUCTIONS" value={entry.total_deductions} divider />
          <View style={styles.summaryItem}>
  <View style={styles.netPill}>
    <Text style={styles.netLabel}>NET SALARY</Text>
    <Text style={styles.netValue}>
      {formatCurrency(entry.net_salary)}
    </Text>
  </View>
</View>
        </View>

        <RupeeNotice />

        <View style={styles.footer}>
          <View style={styles.footerBadge}><PdfIcon name="file" size={15} /></View>
          <Text style={styles.footerText}>System-generated payslip. No signature is required.</Text>
        </View>
      </Page>
    </Document>
  );
}

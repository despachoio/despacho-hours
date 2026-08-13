import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type {
  MonthlyPayrollSummary,
  PayrollSummary,
} from "@/lib/payroll/exports";

const BLUE = "#153E90";
const BORDER = "#D8E3F0";

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 26,
    fontFamily: "Helvetica",
    color: "#0F172A",
    backgroundColor: "#F8FAFC",
  },
  eyebrow: {
    fontSize: 8,
    fontWeight: "bold",
    letterSpacing: 1.4,
    color: "#64748B",
  },
  title: { marginTop: 4, fontSize: 21, fontWeight: "bold", color: BLUE },
  subtitle: { marginTop: 3, fontSize: 9, color: "#64748B" },
  divider: { marginTop: 10, height: 2, backgroundColor: BLUE },
  metrics: { marginTop: 11, flexDirection: "row", gap: 9 },
  metric: {
    flex: 1,
    padding: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
  },
  metricLabel: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#64748B",
    textTransform: "uppercase",
  },
  metricValue: { marginTop: 4, fontSize: 14, fontWeight: "bold", color: BLUE },
  table: {
    marginTop: 11,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
  },
  row: {
    flexDirection: "row",
    minHeight: 18,
    borderBottomWidth: 0.5,
    borderBottomColor: "#E2E8F0",
  },
  lastRow: { borderBottomWidth: 0 },
  alternate: { backgroundColor: "#F8FAFC" },
  header: { minHeight: 25, backgroundColor: "#0F172A" },
  totalRow: { minHeight: 20, backgroundColor: "#E8F0FB" },
  netRow: { minHeight: 22, backgroundColor: BLUE },
  componentCell: {
    width: 142,
    justifyContent: "center",
    paddingHorizontal: 8,
    borderRightWidth: 0.5,
    borderRightColor: BORDER,
  },
  monthCell: {
    flex: 1,
    minWidth: 45,
    justifyContent: "center",
    alignItems: "flex-end",
    paddingHorizontal: 4,
    borderRightWidth: 0.5,
    borderRightColor: BORDER,
  },
  grandCell: {
    width: 73,
    justifyContent: "center",
    alignItems: "flex-end",
    paddingHorizontal: 6,
    borderLeftWidth: 1,
    borderLeftColor: "#7894B8",
  },
  headerText: { fontSize: 6.6, fontWeight: "bold", color: "#FFFFFF" },
  componentHeaderText: {
    fontSize: 6.6,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "left",
  },
  value: {
    fontSize: 6.6,
    fontWeight: "bold",
    color: "#172033",
    textAlign: "right",
  },
  label: { fontSize: 7, color: "#334155" },
  totalText: { fontWeight: "bold", color: BLUE },
  netText: { fontSize: 7.3, fontWeight: "bold", color: "#FFFFFF" },
  footer: {
    position: "absolute",
    left: 22,
    right: 22,
    bottom: 14,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#CBD5E1",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: { fontSize: 7.5, color: "#64748B" },
});

const amount = (value: number) => {
  const rounded = Math.round(Number(value || 0));
  return rounded === 0
    ? "-"
    : rounded.toLocaleString("en-IN", { maximumFractionDigits: 0 });
};

const monthLabel = (month: string) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-IN", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });

type SummaryKey = Exclude<
  keyof PayrollSummary,
  "grossPayroll" | "netPayroll"
>;

const rows: Array<{
  label: string;
  key: SummaryKey;
  tone?: "total" | "net";
}> = [
  { label: "Employees Processed", key: "employeesProcessed" },
  { label: "Basic Pay", key: "basicPay" },
  { label: "HRA", key: "hra" },
  { label: "Conveyance Allowance", key: "conveyanceAllowance" },
  { label: "Other Allowance", key: "otherAllowance" },
  { label: "Bonus", key: "bonus" },
  { label: "Leave Encashment", key: "leaveEncashment" },
  { label: "Gross Pay", key: "grossSalary", tone: "total" },
  { label: "Employee PF", key: "employeePf" },
  { label: "Employer PF", key: "employerPf" },
  { label: "Employer EPS", key: "employerEps" },
  { label: "Administration Charges", key: "administrationCharges" },
  { label: "EDLI Charges", key: "edliCharges" },
  { label: "Total PF Amount", key: "totalPf", tone: "total" },
  { label: "Professional Tax", key: "professionalTax" },
  { label: "LOP", key: "lop" },
  { label: "Previous Month Adjustment", key: "previousMonthAdjustment" },
  { label: "TDS", key: "tds" },
  { label: "Net Salary", key: "netSalary", tone: "net" },
];

export function PayrollSummaryPdfDocument({
  summary,
  monthlySummaries,
  financialYear,
  fromMonth,
  toMonth,
}: {
  summary: PayrollSummary;
  monthlySummaries: MonthlyPayrollSummary[];
  financialYear: string;
  fromMonth: string;
  toMonth: string;
}) {
  return (
    <Document
      title={`Payroll Summary ${financialYear}`}
      author="Despacho India Private Limited"
    >
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.eyebrow}>DESPACHO INDIA PRIVATE LIMITED</Text>
        <Text style={styles.title}>Payroll Summary</Text>
        <Text style={styles.subtitle}>
          Financial Year {financialYear} · {monthLabel(fromMonth)} to {monthLabel(toMonth)}
        </Text>
        <View style={styles.divider} />
        <View style={styles.metrics}>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Employees Processed</Text>
            <Text style={styles.metricValue}>{summary.employeesProcessed}</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Gross Payroll</Text>
            <Text style={styles.metricValue}>{amount(summary.grossPayroll)}</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Net Payroll</Text>
            <Text style={styles.metricValue}>{amount(summary.netPayroll)}</Text>
          </View>
        </View>
        <View style={styles.table}>
          <View style={[styles.row, styles.header]}>
            <View style={styles.componentCell}>
              <Text style={styles.componentHeaderText}>PAYROLL COMPONENT</Text>
            </View>
            {monthlySummaries.map(({ payrollMonth }) => (
              <View key={payrollMonth} style={styles.monthCell}>
                <Text style={styles.headerText}>{monthLabel(payrollMonth)}</Text>
              </View>
            ))}
            <View style={styles.grandCell}>
              <Text style={styles.headerText}>GRAND TOTAL</Text>
            </View>
          </View>
          {rows.map((row, index) => {
            const rowStyle = [
              styles.row,
              index % 2 ? styles.alternate : {},
              row.tone === "total" ? styles.totalRow : {},
              row.tone === "net" ? styles.netRow : {},
              index === rows.length - 1 ? styles.lastRow : {},
            ];
            const labelStyle = [
              styles.label,
              row.tone === "total" ? styles.totalText : {},
              row.tone === "net" ? styles.netText : {},
            ];
            const valueStyle = [
              styles.value,
              row.tone === "total" ? styles.totalText : {},
              row.tone === "net" ? styles.netText : {},
            ];
            return (
              <View key={row.key} style={rowStyle}>
                <View style={styles.componentCell}>
                  <Text style={labelStyle}>{row.label}</Text>
                </View>
                {monthlySummaries.map(({ payrollMonth, summary: month }) => (
                  <View key={payrollMonth} style={styles.monthCell}>
                    <Text style={valueStyle}>{amount(month[row.key])}</Text>
                  </View>
                ))}
                <View style={styles.grandCell}>
                  <Text style={valueStyle}>{amount(summary[row.key])}</Text>
                </View>
              </View>
            );
          })}
        </View>
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            System-generated finance payroll summary.
          </Text>
          <Text style={styles.footerText}>
            All amounts are in Indian Rupees (INR)
          </Text>
        </View>
      </Page>
    </Document>
  );
}

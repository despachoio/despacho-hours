import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { PayrollSummary } from "@/lib/payroll/exports";

const BLUE = "#153E90";
const styles = StyleSheet.create({
  page: { paddingHorizontal: 30, paddingTop: 26, paddingBottom: 28, fontFamily: "Helvetica", color: "#0F172A", backgroundColor: "#F8FAFC" },
  eyebrow: { fontSize: 8, fontWeight: "bold", letterSpacing: 1.4, color: "#64748B" },
  title: { marginTop: 4, fontSize: 21, fontWeight: "bold", color: BLUE },
  subtitle: { marginTop: 3, fontSize: 9, color: "#64748B" },
  divider: { marginTop: 10, height: 2, backgroundColor: BLUE },
  metrics: { marginTop: 12, flexDirection: "row", gap: 10 },
  metric: { flex: 1, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: "#D8E3F0", backgroundColor: "#FFFFFF" },
  metricLabel: { fontSize: 7.5, fontWeight: "bold", color: "#64748B", textTransform: "uppercase" },
  metricValue: { marginTop: 5, fontSize: 15, fontWeight: "bold", color: BLUE },
  table: { marginTop: 12, borderRadius: 8, borderWidth: 1, borderColor: "#D8E3F0", overflow: "hidden", backgroundColor: "#FFFFFF" },
  header: { flexDirection: "row", paddingVertical: 7, paddingHorizontal: 14, backgroundColor: "#0F172A" },
  headerText: { fontSize: 8, fontWeight: "bold", color: "#FFFFFF" },
  row: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 14, borderBottomWidth: 0.5, borderBottomColor: "#E2E8F0" },
  alternate: { backgroundColor: "#F8FAFC" },
  label: { width: "62%", fontSize: 8.5, color: "#334155" },
  value: { width: "38%", fontSize: 8.5, fontWeight: "bold", textAlign: "right", color: "#0F172A" },
  footer: { position: "absolute", left: 30, right: 30, bottom: 18, paddingTop: 6, borderTopWidth: 1, borderTopColor: "#CBD5E1", flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 7.5, color: "#64748B" },
});

const amount = (value: number) => Math.round(value).toLocaleString("en-IN", { maximumFractionDigits: 0 });

export function PayrollSummaryPdfDocument({ summary, financialYear, fromMonth, toMonth }: { summary: PayrollSummary; financialYear: string; fromMonth: string; toMonth: string }) {
  const rows: Array<[string, number]> = [
    ["Basic Pay", summary.basicPay], ["HRA", summary.hra], ["Conveyance Allowance", summary.conveyanceAllowance],
    ["Other Allowance", summary.otherAllowance], ["Bonus", summary.bonus], ["Leave Encashment", summary.leaveEncashment],
    ["Gross Salary", summary.grossSalary], ["Employee PF", summary.employeePf], ["Employer PF", summary.employerPf],
    ["Employer EPS", summary.employerEps], ["Professional Tax", summary.professionalTax], ["LOP", summary.lop],
    ["Previous Month Adjustment", summary.previousMonthAdjustment], ["TDS", summary.tds], ["Net Salary", summary.netSalary],
  ];
  return <Document title={`Payroll Summary ${financialYear}`} author="Despacho India Private Limited"><Page size="A4" orientation="landscape" style={styles.page}><Text style={styles.eyebrow}>DESPACHO INDIA PRIVATE LIMITED</Text><Text style={styles.title}>Payroll Summary</Text><Text style={styles.subtitle}>Financial Year {financialYear} · {fromMonth} to {toMonth}</Text><View style={styles.divider}/><View style={styles.metrics}><View style={styles.metric}><Text style={styles.metricLabel}>Employees Processed</Text><Text style={styles.metricValue}>{summary.employeesProcessed}</Text></View><View style={styles.metric}><Text style={styles.metricLabel}>Gross Payroll</Text><Text style={styles.metricValue}>{amount(summary.grossPayroll)}</Text></View><View style={styles.metric}><Text style={styles.metricLabel}>Net Payroll</Text><Text style={styles.metricValue}>{amount(summary.netPayroll)}</Text></View></View><View style={styles.table}><View style={styles.header}><Text style={styles.label}>PAYROLL COMPONENT</Text><Text style={[styles.value, styles.headerText]}>TOTAL (INR)</Text></View>{rows.map(([label, value], index) => <View key={label} style={[styles.row, index % 2 ? styles.alternate : {}]}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{amount(value)}</Text></View>)}</View><View style={styles.footer}><Text style={styles.footerText}>System-generated finance payroll summary.</Text><Text style={styles.footerText}>All amounts are in Indian Rupees (INR)</Text></View></Page></Document>;
}

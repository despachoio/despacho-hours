import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { PayrollEntry } from "@/lib/payroll/types";

const styles = StyleSheet.create({ page: { padding: 38, fontFamily: "Helvetica", fontSize: 9, color: "#0F172A" }, header: { flexDirection: "row", justifyContent: "space-between", borderBottom: 2, borderBottomColor: "#153E90", paddingBottom: 18 }, logo: { width: 150, height: 42, objectFit: "contain", objectPosition: "left center" }, title: { fontSize: 22, fontWeight: "bold" }, muted: { color: "#64748B", marginTop: 4 }, employee: { marginTop: 20, padding: 15, backgroundColor: "#F8FAFC", borderRadius: 8, flexDirection: "row", justifyContent: "space-between" }, section: { marginTop: 20 }, sectionTitle: { fontSize: 10, color: "#153E90", fontWeight: "bold", textTransform: "uppercase", marginBottom: 8 }, row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottom: 1, borderBottomColor: "#E2E8F0" }, columns: { flexDirection: "row", gap: 24 }, column: { width: "50%" }, total: { marginTop: 18, padding: 16, backgroundColor: "#153E90", color: "#FFFFFF", borderRadius: 8, flexDirection: "row", justifyContent: "space-between", fontSize: 15, fontWeight: "bold" }, footer: { position: "absolute", left: 38, right: 38, bottom: 28, textAlign: "center", color: "#94A3B8", fontSize: 7 } });
const money = (value: number) => `INR ${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const Row = ({ label, value }: { label: string; value: number }) => <View style={styles.row}><Text>{label}</Text><Text>{money(value)}</Text></View>;

export function PayslipPdfDocument({ entry, logoSrc, companyName }: { entry: PayrollEntry; logoSrc: string; companyName: string }) {
  return <Document title={`Payslip ${entry.employee_code} ${entry.payroll_month}`} author={companyName}><Page size="A4" style={styles.page}>
    <View style={styles.header}><View>
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      <Image src={logoSrc} style={styles.logo} />
      <Text style={styles.muted}>{companyName}</Text>
    </View><View><Text style={styles.title}>SALARY SLIP</Text><Text style={styles.muted}>{new Date(`${entry.payroll_month}T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" })}</Text></View></View>
    <View style={styles.employee}><View><Text>{entry.employee_name}</Text><Text style={styles.muted}>Employee Code · {entry.employee_code}</Text></View><View><Text>{entry.department || "—"}</Text><Text style={styles.muted}>{entry.period_start} to {entry.period_end}</Text></View></View>
    <View style={styles.columns}><View style={styles.column}><View style={styles.section}><Text style={styles.sectionTitle}>Earnings</Text><Row label="Basic Pay" value={entry.basic_pay} /><Row label="HRA" value={entry.hra} /><Row label="Conveyance" value={entry.conveyance_allowance} /><Row label="Other Allowance" value={entry.other_allowance} /><Row label="Bonus" value={entry.bonus} /><Row label="Leave Encashment" value={entry.leave_encashment} /><Row label="Reimbursements" value={entry.reimbursements} /><Row label="Total Earnings" value={entry.total_earnings} /></View></View>
    <View style={styles.column}><View style={styles.section}><Text style={styles.sectionTitle}>Deductions</Text><Row label="Employee PF" value={entry.employee_pf} /><Row label="Professional Tax" value={entry.professional_tax} /><Row label="LOP" value={entry.lop_deduction} /><Row label="Previous Adjustment" value={entry.previous_month_adjustment} /><Row label="TDS" value={entry.tds} /><Row label="Total Deductions" value={entry.total_deductions} /></View><View style={styles.section}><Text style={styles.sectionTitle}>Employer contribution</Text><Row label="Employer PF" value={entry.employer_pf} /><Row label="Employer EPS" value={entry.employer_eps} /></View></View></View>
    <View style={styles.total}><Text>NET SALARY</Text><Text>{money(entry.net_salary)}</Text></View>
    <Text style={styles.footer}>System-generated payslip. No signature is required. Historical figures are taken from the locked payroll snapshot.</Text>
  </Page></Document>;
}

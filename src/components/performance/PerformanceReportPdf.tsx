/* eslint-disable jsx-a11y/alt-text */
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { PerformanceCalculation, PerformanceEmployee, PerformanceEvent } from "@/lib/performance/types";

const DESPACHO_BLUE = "#153E90";
const MAX_VISIBLE_EVENTS = 4;
const MAX_VISIBLE_COMMENTS = 2;

const styles = StyleSheet.create({
  page: { padding: 22, paddingBottom: 34, fontFamily: "Helvetica", fontSize: 7, color: "#172033", backgroundColor: "#FFFFFF" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: 8, borderBottomWidth: 1.5, borderBottomColor: DESPACHO_BLUE },
  logo: { width: 112, height: 31, objectFit: "contain", objectPosition: "left center" },
  right: { alignItems: "flex-end" },
  title: { fontSize: 17, fontWeight: "bold", color: DESPACHO_BLUE },
  subtitle: { fontSize: 8, color: "#64748B", marginTop: 2 },
  card: { marginTop: 8, borderWidth: 0.8, borderColor: "#D7E0EA", borderRadius: 6, overflow: "hidden" },
  cardTitle: { paddingHorizontal: 7, paddingVertical: 5, backgroundColor: "#F1F6FC", fontSize: 8, fontWeight: "bold", color: DESPACHO_BLUE },
  info: { flexDirection: "row", paddingHorizontal: 8, paddingVertical: 5, gap: 14 },
  column: { width: "50%" },
  line: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2, borderBottomWidth: 0.35, borderBottomColor: "#EEF2F7" },
  label: { color: "#64748B" },
  value: { fontWeight: "bold" },
  metrics: { flexDirection: "row", gap: 4, marginTop: 7 },
  metric: { flex: 1, borderWidth: 0.7, borderColor: "#D7E0EA", borderRadius: 5, padding: 6, minHeight: 39 },
  metricLabel: { fontSize: 5.5, color: "#64748B", textTransform: "uppercase" },
  metricValue: { marginTop: 3, fontSize: 9, fontWeight: "bold", color: DESPACHO_BLUE },
  table: { marginTop: 7, borderWidth: 0.7, borderColor: "#CBD5E1" },
  row: { flexDirection: "row", minHeight: 17, borderBottomWidth: 0.35, borderBottomColor: "#CBD5E1", alignItems: "center" },
  head: { backgroundColor: "#0F172A", color: "#FFFFFF", fontWeight: "bold", fontSize: 5.5 },
  cell: { paddingHorizontal: 3, width: "14.285%" },
  eventRow: { flexDirection: "row", paddingHorizontal: 6, paddingVertical: 4, borderBottomWidth: 0.35, borderBottomColor: "#E2E8F0", alignItems: "center" },
  eventName: { width: "22%", fontWeight: "bold" },
  eventDate: { width: "14%", color: "#64748B" },
  eventDescription: { width: "54%" },
  eventScore: { width: "10%", textAlign: "right", fontWeight: "bold" },
  overflowNote: { paddingHorizontal: 6, paddingVertical: 4, color: "#64748B", fontSize: 6 },
  summary: { marginTop: 7, backgroundColor: DESPACHO_BLUE, color: "#FFFFFF", borderRadius: 6, paddingHorizontal: 9, paddingVertical: 7, flexDirection: "row", justifyContent: "space-between" },
  summaryLabel: { fontSize: 5.5 },
  summaryValue: { fontSize: 10, fontWeight: "bold", marginTop: 2 },
  notes: { marginTop: 7, borderWidth: 0.7, borderColor: "#D7E0EA", borderRadius: 5, paddingHorizontal: 7, paddingVertical: 5 },
  note: { marginBottom: 2, fontSize: 6.5 },
  footer: { position: "absolute", left: 22, right: 22, bottom: 16, borderTopWidth: 0.7, borderTopColor: "#CBD5E1", paddingTop: 5, flexDirection: "row", justifyContent: "space-between", color: "#64748B", fontSize: 6 },
});

function infoRow(label: string, value: string) {
  return <View style={styles.line}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}</Text></View>;
}

export function PerformanceReportPdf({logoSrc,year,employee,calculation,events,comments,reviewStatus="Finalized"}:{logoSrc:string;year:number;employee:PerformanceEmployee;calculation:PerformanceCalculation;events:PerformanceEvent[];comments:Array<{comment_type:string;comment:string}>;reviewStatus?:string}) {
  const visibleEvents=events.slice(0,MAX_VISIBLE_EVENTS);
  const visibleComments=comments.slice(0,MAX_VISIBLE_COMMENTS);
  const notes=[...calculation.eligibilityReasons,...calculation.criticalFlags];
  return <Document title={`Performance Report ${employee.employee_code} ${year}`}>
    <Page size="A4" orientation="portrait" wrap={false} style={styles.page}>
      <View style={styles.header}><Image src={logoSrc} style={styles.logo}/><View style={styles.right}><Text style={styles.title}>PERFORMANCE REPORT</Text><Text style={styles.subtitle}>Annual Review · {year}</Text></View></View>
      <View style={styles.card}><Text style={styles.cardTitle}>EMPLOYEE INFORMATION</Text><View style={styles.info}><View style={styles.column}>{infoRow("Employee Code",employee.employee_code||"—")}{infoRow("Employee Name",employee.name)}{infoRow("Designation",employee.role||"—")}{infoRow("Department",employee.department||"—")}</View><View style={styles.column}>{infoRow("Employee Level",employee.level||"Level 1")}{infoRow("Reporting Manager",employee.reporting_manager?.name||"—")}{infoRow("Date of Joining",employee.date_of_joining||"—")}{infoRow("Review Status",reviewStatus)}</View></View></View>
      <View style={styles.metrics}>{[["Overall Score",`${calculation.overallScore.toFixed(2)}%`],["Billable Utilization",`${calculation.utilizationPercent.toFixed(2)}%`],["Recognition",`+${calculation.boosterScore.toFixed(2)}%`],["Penalties",`-${calculation.penaltyScore.toFixed(2)}%`],["Appraisal",calculation.eligibility.replaceAll("_"," ")]].map(([label,value])=><View key={label} style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text></View>)}</View>
      <View style={styles.table}><View style={[styles.row,styles.head]}>{["Quarter","Expected Hours","Actual Hours","Utilization","Minimum %","Expected %","Status"].map(item=><Text key={item} style={styles.cell}>{item}</Text>)}</View>{calculation.quarterly.map(item=><View key={item.quarter} style={styles.row}><Text style={styles.cell}>Q{item.quarter}</Text><Text style={styles.cell}>{item.expected}</Text><Text style={styles.cell}>{item.actual.toFixed(2)}</Text><Text style={styles.cell}>{item.percent.toFixed(2)}%</Text><Text style={styles.cell}>{calculation.policy.minimum_percent}%</Text><Text style={styles.cell}>{calculation.policy.expected_percent}%</Text><Text style={styles.cell}>{item.actual>=calculation.policy.quarterly_minimum_hours?"Meets minimum":"Below minimum"}</Text></View>)}</View>
      <View style={styles.card}><Text style={styles.cardTitle}>RECOGNITION, BOOSTERS & PERFORMANCE ISSUES</Text>{visibleEvents.length?visibleEvents.map(event=>{const scored=calculation.scoredEvents.find(item=>item.id===event.id);return <View key={event.id} style={styles.eventRow}><Text style={styles.eventName}>{event.metric?.name}</Text><Text style={styles.eventDate}>{event.event_date}</Text><Text style={styles.eventDescription}>{event.description}{event.client?.name?` · ${event.client.name}`:""}</Text><Text style={styles.eventScore}>{(scored?.appliedScore||0)>0?"+":""}{scored?.appliedScore||0}%</Text></View>}):<Text style={styles.overflowNote}>No performance events recorded.</Text>}{events.length>visibleEvents.length?<Text style={styles.overflowNote}>+ {events.length-visibleEvents.length} additional event record(s) are available in Kairo.</Text>:null}</View>
      <View style={styles.summary}><View><Text style={styles.summaryLabel}>PERFORMANCE CATEGORY</Text><Text style={styles.summaryValue}>{calculation.category}</Text></View><View style={{alignItems:"flex-end"}}><Text style={styles.summaryLabel}>APPRAISAL ELIGIBILITY</Text><Text style={styles.summaryValue}>{calculation.eligibility.replaceAll("_"," ").toUpperCase()}</Text></View></View>
      {notes.length||visibleComments.length?<View style={styles.notes}>{notes.slice(0,4).map(item=><Text key={item} style={styles.note}>• {item}</Text>)}{visibleComments.map((item,index)=><Text key={`${item.comment_type}-${index}`} style={styles.note}>{item.comment_type.toUpperCase()}: {item.comment}</Text>)}{comments.length>visibleComments.length?<Text style={styles.note}>+ {comments.length-visibleComments.length} additional comment(s) are available in Kairo.</Text>:null}</View>:null}
      <View style={styles.footer}><Text>System-generated performance report. No signature is required.</Text><Text>Despacho India Private Limited · Confidential</Text></View>
    </Page>
  </Document>;
}

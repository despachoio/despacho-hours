import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { PolicySection, TeamPolicyDocument } from "@/lib/team-policies";

const BLUE = "#153E90";
const styles = StyleSheet.create({
  page: { paddingTop: 34, paddingHorizontal: 38, paddingBottom: 48, fontFamily: "Helvetica", color: "#1E293B", fontSize: 9.2, lineHeight: 1.5, backgroundColor: "#FFFFFF" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: 16, borderBottomWidth: 1.5, borderBottomColor: BLUE },
  logo: { width: 145, height: 42, objectFit: "contain", objectPosition: "left center" },
  internal: { fontSize: 7.5, color: "#64748B", letterSpacing: 1.2, textTransform: "uppercase" },
  titleBlock: { marginTop: 22, borderRadius: 10, padding: 18, backgroundColor: "#F2F7FD", borderWidth: 1, borderColor: "#D9E6F5" },
  category: { fontSize: 8, color: BLUE, fontWeight: "bold", letterSpacing: 1.4, textTransform: "uppercase" },
  title: { marginTop: 5, fontSize: 23, color: "#0F2E68", fontWeight: "bold" },
  metadata: { marginTop: 9, flexDirection: "row", gap: 18, color: "#64748B", fontSize: 8.2 },
  description: { marginTop: 9, color: "#475569", fontSize: 9.2 },
  section: { marginTop: 16, padding: 14, borderRadius: 8, borderWidth: 1, borderColor: "#E2E8F0", backgroundColor: "#FFFFFF" },
  sectionHeading: { fontSize: 12, fontWeight: "bold", color: BLUE, marginBottom: 7 },
  paragraph: { marginTop: 4, color: "#334155" },
  bulletRow: { flexDirection: "row", marginTop: 4, paddingRight: 5 },
  bullet: { width: 12, color: BLUE, fontWeight: "bold" },
  bulletText: { flex: 1, color: "#334155" },
  table: { marginTop: 8, borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 5, overflow: "hidden" },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.6, borderBottomColor: "#DCE4ED" },
  tableHeader: { backgroundColor: "#153E90" },
  tableCell: { flex: 1, minWidth: 0, paddingVertical: 5, paddingHorizontal: 4, fontSize: 6.8, color: "#334155" },
  tableHeaderText: { color: "#FFFFFF", fontWeight: "bold", fontSize: 6.5 },
  tableAlt: { backgroundColor: "#F8FAFC" },
  footer: { position: "absolute", left: 38, right: 38, bottom: 20, flexDirection: "row", justifyContent: "space-between", paddingTop: 8, borderTopWidth: 1, borderTopColor: "#CBD5E1", color: "#64748B", fontSize: 7.2 },
});

export function PolicyPdfDocument({ policy, sections, logoSrc }: { policy: TeamPolicyDocument; sections: PolicySection[]; logoSrc: string }) {
  return <Document title={policy.title} author="Despacho India Private Limited" subject="Internal policy document">
    <Page size="A4" style={styles.page} wrap>
      <View style={styles.header} fixed>
        {/* @react-pdf Image does not expose the DOM alt attribute. */}
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <Image src={logoSrc} style={styles.logo} />
        <Text style={styles.internal}>Internal policy library</Text>
      </View>
      <View style={styles.titleBlock}>
        <Text style={styles.category}>{policy.category}</Text>
        <Text style={styles.title}>{policy.title}</Text>
        <View style={styles.metadata}>
          <Text>Version {policy.version}</Text>
          <Text>Effective: {policy.effectiveDate}</Text>
          {policy.lastUpdated ? <Text>Last updated: {policy.lastUpdated}</Text> : null}
        </View>
        <Text style={styles.description}>{policy.description}</Text>
      </View>
      {sections.map((section, sectionIndex) => <View key={`${section.heading}-${sectionIndex}`} style={styles.section} wrap={false}>
        <Text style={styles.sectionHeading}>{section.heading}</Text>
        {section.paragraphs?.map((paragraph, index) => <Text key={index} style={styles.paragraph}>{paragraph}</Text>)}
        {section.bullets?.map((bullet, index) => <View key={index} style={styles.bulletRow}><Text style={styles.bullet}>•</Text><Text style={styles.bulletText}>{bullet}</Text></View>)}
        {section.table ? <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>{section.table.columns.map((column) => <Text key={column} style={[styles.tableCell, styles.tableHeaderText]}>{column}</Text>)}</View>
          {section.table.rows.map((row, index) => <View key={index} style={[styles.tableRow, ...(index % 2 ? [styles.tableAlt] : [])]}>{row.map((cell, cellIndex) => <Text key={cellIndex} style={styles.tableCell}>{String(cell)}</Text>)}</View>)}
        </View> : null}
      </View>)}
      <View style={styles.footer} fixed>
        <Text>Despacho India Private Limited · System-generated internal policy document</Text>
        <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
      </View>
    </Page>
  </Document>;
}

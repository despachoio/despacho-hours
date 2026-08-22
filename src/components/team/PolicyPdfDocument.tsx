import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { PolicyBlock, StructuredPolicyDocument } from "@/lib/team-policies";

const BLUE = "#153E90";
const styles = StyleSheet.create({
  page: { paddingTop: 58, paddingHorizontal: 38, paddingBottom: 50, fontFamily: "Helvetica", color: "#1E293B", fontSize: 8.9, lineHeight: 1.42, backgroundColor: "#FFFFFF" },
  continuationHeader: { position: "absolute", top: 24, left: 38, right: 38, height: 24, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#D7E2EF", paddingBottom: 5 },
  logo: { width: 72.5, height: 21, objectFit: "contain", objectPosition: "left center" },
  continuationText: { fontSize: 7, color: "#64748B", letterSpacing: 0.8, textTransform: "uppercase" },
  hero: { marginTop: 7, paddingBottom: 17, borderBottomWidth: 1.5, borderBottomColor: BLUE },
  library: { fontSize: 7.5, color: "#64748B", letterSpacing: 1.3, textTransform: "uppercase" },
  category: { marginTop: 18, fontSize: 8, color: BLUE, fontWeight: "bold", letterSpacing: 1.3, textTransform: "uppercase" },
  title: { marginTop: 4, fontSize: 22, color: "#0F2E68", fontWeight: "bold", lineHeight: 1.18 },
  description: { marginTop: 8, maxWidth: 410, color: "#475569", fontSize: 9.4, lineHeight: 1.45 },
  metadata: { marginTop: 13, flexDirection: "row", gap: 8 },
  metadataCell: { flex: 1, minHeight: 43, borderRadius: 6, borderWidth: 1, borderColor: "#D9E6F5", backgroundColor: "#F7FAFE", paddingVertical: 7, paddingHorizontal: 9 },
  metadataLabel: { fontSize: 6.5, color: "#64748B", fontWeight: "bold", letterSpacing: 0.8, textTransform: "uppercase" },
  metadataValue: { marginTop: 3, fontSize: 8.3, color: "#1E3A5F", fontWeight: "bold" },
  heading2: { marginTop: 12, marginBottom: 4, fontSize: 11.5, fontWeight: "bold", color: BLUE, borderBottomWidth: 0.6, borderBottomColor: "#DCE7F4", paddingBottom: 3 },
  heading3: { marginTop: 10, marginBottom: 3, fontSize: 9.8, fontWeight: "bold", color: "#334155" },
  paragraph: { marginTop: 4, color: "#334155", orphans: 2, widows: 2 },
  list: { marginTop: 3 },
  listRow: { flexDirection: "row", marginTop: 2, paddingRight: 4 },
  marker: { width: 16, color: BLUE, fontWeight: "bold", textAlign: "right", marginRight: 6 },
  listText: { flex: 1, color: "#334155", orphans: 2, widows: 2 },
  callout: { marginTop: 7, borderRadius: 6, borderWidth: 1, borderColor: "#CFE0F4", backgroundColor: "#F2F7FD", padding: 9, color: "#29476D" },
  table: { marginTop: 7, borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 5, overflow: "hidden" },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.6, borderBottomColor: "#DCE4ED" },
  tableHeader: { backgroundColor: BLUE },
  tableCell: { flex: 1, minWidth: 0, paddingVertical: 5, paddingHorizontal: 4, fontSize: 6.7, color: "#334155" },
  tableHeaderText: { color: "#FFFFFF", fontWeight: "bold", fontSize: 6.4 },
  tableAlt: { backgroundColor: "#F8FAFC" },
  acknowledgement: { marginTop: 9, borderRadius: 7, borderWidth: 1, borderColor: "#CBD5E1", backgroundColor: "#F8FAFC", padding: 10 },
  acknowledgementTitle: { color: BLUE, fontWeight: "bold", fontSize: 9.5 },
  fields: { marginTop: 10, flexDirection: "row", gap: 12 },
  field: { flex: 1 },
  fieldLabel: { fontSize: 7, color: "#64748B", fontWeight: "bold" },
  fieldLine: { marginTop: 15, borderBottomWidth: 0.8, borderBottomColor: "#64748B" },
  footer: { position: "absolute", left: 38, right: 38, bottom: 19, minHeight: 18, paddingTop: 7, borderTopWidth: 1, borderTopColor: "#CBD5E1" },
  footerText: { color: "#64748B", fontSize: 7 },
});

function PdfTable({ block }: { block: Extract<PolicyBlock, { type: "table" }> }) {
  return <View style={styles.table} wrap>
    <View style={[styles.tableRow, styles.tableHeader]} fixed>{block.table.columns.map((column) => <Text key={column} style={[styles.tableCell, styles.tableHeaderText]}>{column}</Text>)}</View>
    {block.table.rows.map((row, index) => <View key={index} style={[styles.tableRow, ...(index % 2 ? [styles.tableAlt] : [])]} wrap={false}>{row.map((cell, cellIndex) => <Text key={cellIndex} style={styles.tableCell}>{String(cell)}</Text>)}</View>)}
  </View>;
}

function PdfBlock({ block }: { block: PolicyBlock }) {
  switch (block.type) {
    case "heading": return <Text style={block.level === 2 ? styles.heading2 : styles.heading3} minPresenceAhead={45}>{block.number ? `${block.number}. ` : ""}{block.text}</Text>;
    case "paragraph": return <Text style={styles.paragraph}>{block.text}</Text>;
    case "ordered-list": return <View style={styles.list}>{block.items.map((item, index) => <View key={index} style={styles.listRow} wrap={false}><Text style={styles.marker}>{index + 1}.</Text><Text style={styles.listText}>{item}</Text></View>)}</View>;
    case "unordered-list": return <View style={styles.list}>{block.items.map((item, index) => <View key={index} style={styles.listRow} wrap={false}><Text style={styles.marker}>•</Text><Text style={styles.listText}>{item}</Text></View>)}</View>;
    case "callout": return <Text style={styles.callout} wrap={false}>{block.text}</Text>;
    case "table": return <PdfTable block={block}/>;
    case "acknowledgement": return <View style={styles.acknowledgement} wrap={false}><Text style={styles.acknowledgementTitle}>{block.title}</Text><View style={styles.fields}>{block.fields.map((field) => <View key={field} style={styles.field}><Text style={styles.fieldLabel}>{field}</Text><View style={styles.fieldLine}/></View>)}</View></View>;
    case "spacer": return <View style={{ height: block.size === "md" ? 12 : 6 }}/>;
  }
}

export function PolicyPdfDocument({ document, logoSrc }: { document: StructuredPolicyDocument; logoSrc: string }) {
  return <Document title={document.title} author="Despacho India Private Limited" subject="Internal policy document">
    <Page size="A4" style={styles.page} wrap>
      <View style={styles.continuationHeader} fixed>
        {/* @react-pdf Image does not expose the DOM alt attribute. */}
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <Image src={logoSrc} style={styles.logo}/>
        <Text style={styles.continuationText}>Internal policy library  ·  {document.title}</Text>
      </View>
      <View style={styles.footer} fixed><Text style={styles.footerText}>Despacho India Private Limited  ·  System-generated internal policy document</Text></View>
      <View style={styles.hero} wrap={false}>
        <Text style={styles.library}>Internal policy library</Text>
        <Text style={styles.category}>{document.category}</Text>
        <Text style={styles.title}>{document.title}</Text>
        <Text style={styles.description}>{document.description}</Text>
        <View style={styles.metadata}>
          <View style={styles.metadataCell}><Text style={styles.metadataLabel}>Version</Text><Text style={styles.metadataValue}>{document.version}</Text></View>
          <View style={styles.metadataCell}><Text style={styles.metadataLabel}>Effective</Text><Text style={styles.metadataValue}>{document.effectiveDate}</Text></View>
          {document.lastUpdated ? <View style={styles.metadataCell}><Text style={styles.metadataLabel}>Last Updated</Text><Text style={styles.metadataValue}>{document.lastUpdated}</Text></View> : null}
        </View>
      </View>
      {document.blocks.map((block, index) => <PdfBlock key={`${block.type}-${index}`} block={block}/>)}
    </Page>
  </Document>;
}

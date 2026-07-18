"use client";

import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from "@react-pdf/renderer";
import * as XLSX from "xlsx";
import { formatDecimalHours } from "@/lib/format-hours";
import type { AggregateRow, ReportFiltersValue, SummaryMetric } from "./types";

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
function escapeCsv(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
function exportRows(rows: AggregateRow[], employeeColumn: boolean) {
  return rows.map((row) => ({
    ...(employeeColumn ? { Employee: row.employeeName } : {}),
    Client: row.clientName,
    "Project Code": row.projectCode || "",
    Project: row.projectName,
    "Total Hours": formatDecimalHours(row.totalHours),
    Entries: row.entries,
    "Average Session": formatDecimalHours(row.averageSession),
    "Longest Session": formatDecimalHours(row.longestSession),
    "Utilisation %": Number(row.utilisation.toFixed(1)),
  }));
}

function filterDescription(filters: ReportFiltersValue) {
  return [
    `Date preset: ${filters.datePreset}`,
    filters.employeeId
      ? `Employee ID: ${filters.employeeId}`
      : "All visible employees",
    filters.clientId ? `Client ID: ${filters.clientId}` : "All visible clients",
    filters.projectId
      ? `Project ID: ${filters.projectId}`
      : "All visible projects",
    `Status: ${filters.status}`,
    filters.search ? `Search: ${filters.search}` : "No search term",
  ].join(" | ");
}

export default function ReportExportButtons({
  rows,
  filters,
  summary,
  period,
  employeeColumn,
}: {
  rows: AggregateRow[];
  filters: ReportFiltersValue;
  summary: SummaryMetric[];
  period: { from: string; to: string };
  employeeColumn: boolean;
}) {
  const disabled = rows.length === 0;
  function csv() {
    const records = exportRows(rows, employeeColumn);
    const headers = Object.keys(records[0]);
    const content = [
      ["Kairo Report"].map(escapeCsv).join(","),
      ["Period", `${period.from} to ${period.to}`].map(escapeCsv).join(","),
      ["Filters", filterDescription(filters)].map(escapeCsv).join(","),
      ...summary.map((metric) =>
        [metric.label, metric.value].map(escapeCsv).join(","),
      ),
      "",
      headers.map(escapeCsv).join(","),
      ...records.map((row) =>
        headers
          .map((header) => escapeCsv(row[header as keyof typeof row]))
          .join(","),
      ),
    ].join("\n");
    download(
      new Blob([content], { type: "text/csv;charset=utf-8" }),
      `Kairo_Report_${period.from}_${period.to}.csv`,
    );
  }
  function excel() {
    const book = XLSX.utils.book_new();
    const context = XLSX.utils.aoa_to_sheet([
      ["Kairo Report"],
      ["Period", `${period.from} to ${period.to}`],
      ["Filters", filterDescription(filters)],
      [],
      ...summary.map((metric) => [metric.label, metric.value]),
    ]);
    XLSX.utils.book_append_sheet(book, context, "Summary");
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.json_to_sheet(exportRows(rows, employeeColumn)),
      "Aggregated Report",
    );
    XLSX.writeFile(book, `Kairo_Report_${period.from}_${period.to}.xlsx`);
  }
  async function pdfExport() {
    const blob = await pdf(
      <ReportPdf
        rows={rows}
        summary={summary}
        period={period}
        filters={filters}
        employeeColumn={employeeColumn}
      />,
    ).toBlob();
    download(blob, `Kairo_Report_${period.from}_${period.to}.pdf`);
  }
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={disabled}
        onClick={csv}
        className="rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40"
      >
        CSV
      </button>
      <button
        type="button"
        data-shortcut-export
        disabled={disabled}
        onClick={excel}
        className="rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40"
      >
        Excel
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => void pdfExport()}
        className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-[#0F172A] disabled:opacity-40"
      >
        PDF
      </button>
    </div>
  );
}

const styles = StyleSheet.create({
  page: { padding: 30, fontFamily: "Helvetica", fontSize: 8, color: "#0F172A" },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#153E90",
    marginBottom: 6,
  },
  subtitle: { color: "#64748B", marginBottom: 16 },
  summary: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  metric: {
    width: "23%",
    padding: 8,
    backgroundColor: "#F8FAFC",
    borderRadius: 4,
  },
  metricLabel: { color: "#64748B", fontSize: 7 },
  metricValue: { fontWeight: "bold", marginTop: 3 },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 6,
  },
  header: { backgroundColor: "#0F172A", color: "#FFFFFF", fontWeight: "bold" },
  cell: { flex: 1, paddingHorizontal: 4 },
  number: { width: 55, paddingHorizontal: 4, textAlign: "right" },
});
function ReportPdf({
  rows,
  summary,
  period,
  filters,
  employeeColumn,
}: {
  rows: AggregateRow[];
  summary: SummaryMetric[];
  period: { from: string; to: string };
  filters: ReportFiltersValue;
  employeeColumn: boolean;
}) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>Kairo Operational Report</Text>
        <Text style={styles.subtitle}>
          {period.from} to {period.to}
        </Text>
        <Text style={styles.subtitle}>{filterDescription(filters)}</Text>
        <View style={styles.summary}>
          {summary.map((metric) => (
            <View key={metric.label} style={styles.metric}>
              <Text style={styles.metricLabel}>{metric.label}</Text>
              <Text style={styles.metricValue}>{metric.value}</Text>
            </View>
          ))}
        </View>
        <View style={[styles.row, styles.header]}>
          {employeeColumn ? <Text style={styles.cell}>Employee</Text> : null}
          <Text style={styles.cell}>Client</Text>
          <Text style={styles.cell}>Project</Text>
          <Text style={styles.number}>Hours</Text>
          <Text style={styles.number}>Entries</Text>
          <Text style={styles.number}>Avg.</Text>
          <Text style={styles.number}>Longest</Text>
          <Text style={styles.number}>Util.</Text>
        </View>
        {rows.map((row) => (
          <View key={row.id} style={styles.row} wrap={false}>
            {employeeColumn ? (
              <Text style={styles.cell}>{row.employeeName}</Text>
            ) : null}
            <Text style={styles.cell}>{row.clientName}</Text>
            <Text style={styles.cell}>{row.projectName}</Text>
            <Text style={styles.number}>{formatDecimalHours(row.totalHours)}</Text>
            <Text style={styles.number}>{row.entries}</Text>
            <Text style={styles.number}>{formatDecimalHours(row.averageSession)}</Text>
            <Text style={styles.number}>{formatDecimalHours(row.longestSession)}</Text>
            <Text style={styles.number}>{row.utilisation.toFixed(1)}%</Text>
          </View>
        ))}
      </Page>
    </Document>
  );
}

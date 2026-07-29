"use client";

import { Document, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
import * as XLSX from "xlsx";
import type { TimeOffAdminData } from "@/lib/time-off/client";

type BalanceRow = TimeOffAdminData["balances"][number];

function records(rows: BalanceRow[]) {
  return rows.map((row) => ({
    "Employee Code": row.employees?.employee_code || "",
    "Employee Name": row.employees?.name || "",
    Department: row.employees?.department || "",
    Year: row.leave_year,
    "Leave Type": row.leave_types?.name || "",
    Entitled: row.entitled_days,
    Used: row.used_days,
    Pending: row.pending_days,
    Adjusted: row.adjustment_days,
    Available: row.available_days,
  }));
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function csvValue(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export default function TimeOffBalanceExportButtons({ rows, year }: { rows: BalanceRow[]; year: number }) {
  const disabled = rows.length === 0;

  function exportCsv() {
    const values = records(rows);
    const headers = Object.keys(values[0]);
    const content = [
      headers.map(csvValue).join(","),
      ...values.map((record) => headers.map((header) => csvValue(record[header as keyof typeof record])).join(",")),
    ].join("\n");
    download(new Blob([content], { type: "text/csv;charset=utf-8" }), `Kairo_Leave_Balances_${year}.csv`);
  }

  function exportExcel() {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(records(rows));
    XLSX.utils.book_append_sheet(workbook, sheet, "Leave Balances");
    XLSX.writeFile(workbook, `Kairo_Leave_Balances_${year}.xlsx`);
  }

  async function exportPdf() {
    const blob = await pdf(<BalanceReportPdf rows={rows} year={year} />).toBlob();
    download(blob, `Kairo_Leave_Balances_${year}.pdf`);
  }

  const secondary = "h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40";
  return <div className="flex flex-wrap gap-2"><button type="button" disabled={disabled} onClick={exportCsv} className={secondary}>CSV</button><button type="button" disabled={disabled} onClick={exportExcel} className={secondary}>Excel</button><button type="button" disabled={disabled} onClick={() => void exportPdf()} className="h-11 rounded-xl bg-[#0F172A] px-4 text-sm font-bold text-white transition hover:bg-[#153E90] disabled:cursor-not-allowed disabled:opacity-40">PDF</button></div>;
}

const styles = StyleSheet.create({
  page: { padding: 28, fontFamily: "Helvetica", fontSize: 7, color: "#0F172A" },
  title: { fontSize: 18, fontWeight: "bold", color: "#153E90", marginBottom: 4 },
  subtitle: { color: "#64748B", marginBottom: 14 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#CBD5E1", paddingVertical: 5 },
  header: { backgroundColor: "#0F172A", color: "#FFFFFF", fontWeight: "bold" },
  code: { width: "12%", paddingHorizontal: 3 },
  employee: { width: "18%", paddingHorizontal: 3 },
  type: { width: "16%", paddingHorizontal: 3 },
  number: { width: "10%", paddingHorizontal: 3, textAlign: "right" },
});

function BalanceReportPdf({ rows, year }: { rows: BalanceRow[]; year: number }) {
  return <Document><Page size="A4" orientation="landscape" style={styles.page}><Text style={styles.title}>Kairo Employee Leave Balances</Text><Text style={styles.subtitle}>Leave year {year} · {rows.length} filtered records</Text><View style={[styles.row, styles.header]}><Text style={styles.code}>Employee Code</Text><Text style={styles.employee}>Employee Name</Text><Text style={styles.type}>Leave Type</Text><Text style={styles.number}>Entitled</Text><Text style={styles.number}>Used</Text><Text style={styles.number}>Pending</Text><Text style={styles.number}>Adjusted</Text><Text style={styles.number}>Available</Text></View>{rows.map((row) => <View key={row.id} style={styles.row} wrap={false}><Text style={styles.code}>{row.employees?.employee_code || "—"}</Text><Text style={styles.employee}>{row.employees?.name || ""}</Text><Text style={styles.type}>{row.leave_types?.name || ""}</Text><Text style={styles.number}>{row.entitled_days}</Text><Text style={styles.number}>{row.used_days}</Text><Text style={styles.number}>{row.pending_days}</Text><Text style={styles.number}>{row.adjustment_days}</Text><Text style={styles.number}>{row.available_days}</Text></View>)}</Page></Document>;
}

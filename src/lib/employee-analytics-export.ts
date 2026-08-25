import type { EmployeeAnalytics, TeamEntry } from "@/components/team/types";
import { formatDecimalHours } from "@/lib/format-hours";

export type EmployeeAnalyticsExportInput = {
  employeeName: string;
  employeeCode: string;
  periodLabel: string;
  from: string;
  to: string;
  clientLabel: string;
  projectLabel: string;
  analytics: EmployeeAnalytics;
  entries: TeamEntry[];
};

const csvCell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;

export function buildEmployeeAnalyticsCsv(input: EmployeeAnalyticsExportInput) {
  const rows: Array<Array<string | number>> = [
    ["Employee Analytics"],
    ["Employee Code", input.employeeCode],
    ["Employee Name", input.employeeName],
    ["Period", input.periodLabel],
    ["Resolved Range", `${input.from} to ${input.to}`],
    ["Client", input.clientLabel],
    ["Project", input.projectLabel],
    [],
    ["Entries", input.analytics.entries.length],
    ["Total Hours", Number(input.analytics.hours.toFixed(2))],
    ["Billable Hours", Number(input.analytics.billableHours.toFixed(2))],
    ["Non-Billable Hours", Number(input.analytics.nonBillableHours.toFixed(2))],
    ["Utilisation %", Number(input.analytics.utilisation.toFixed(2))],
    ["Projects Worked", input.analytics.projects],
    ["Clients Worked", input.analytics.clients],
    [],
    ["Date", "Client", "Project Code", "Project", "Description", "Billable", "Hours"],
    ...input.entries.map((entry) => [
      entry.entry_date,
      entry.projects?.clients?.name || "Unassigned client",
      entry.projects?.project_code || "",
      entry.projects?.name || "Unassigned project",
      entry.description || "",
      entry.projects?.is_billable === false ? "No" : "Yes",
      Number(entry.hours || 0).toFixed(2),
    ]),
  ];
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

export async function buildEmployeeAnalyticsPdf(input: EmployeeAnalyticsExportInput) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const navy = rgb(21 / 255, 62 / 255, 144 / 255);
  const slate = rgb(71 / 255, 85 / 255, 105 / 255);
  const width = 595.28;
  const height = 841.89;
  const margin = 42;
  let page = pdf.addPage([width, height]);
  let y = height - margin;

  const text = (value: string, x: number, size = 9, font = regular, color = slate) => {
    page.drawText(value, { x, y, size, font, color });
  };
  const newPage = () => {
    page = pdf.addPage([width, height]);
    y = height - margin;
  };
  const line = (label: string, value: string) => {
    text(label, margin, 8, bold, slate);
    text(value, margin + 120, 8, regular, slate);
    y -= 15;
  };

  text("KAIRO · EMPLOYEE ANALYTICS", margin, 11, bold, navy);
  y -= 25;
  text(input.employeeName, margin, 19, bold, navy);
  y -= 22;
  line("Employee Code", input.employeeCode || "—");
  line("Period", `${input.periodLabel} · ${input.from} – ${input.to}`);
  line("Filters", `${input.clientLabel} · ${input.projectLabel}`);
  y -= 8;
  page.drawRectangle({ x: margin, y: y - 66, width: width - margin * 2, height: 72, color: rgb(248 / 255, 250 / 255, 252 / 255), borderColor: rgb(203 / 255, 213 / 255, 225 / 255), borderWidth: 1 });
  const metrics = [
    ["Entries", String(input.analytics.entries.length)],
    ["Total Hours", formatDecimalHours(input.analytics.hours)],
    ["Billable", formatDecimalHours(input.analytics.billableHours)],
    ["Non-Billable", formatDecimalHours(input.analytics.nonBillableHours)],
    ["Utilisation", `${input.analytics.utilisation.toFixed(0)}%`],
  ];
  metrics.forEach(([label, value], index) => {
    const x = margin + 16 + index * 98;
    page.drawText(label, { x, y: y - 18, size: 7, font: bold, color: slate });
    page.drawText(value, { x, y: y - 42, size: 13, font: bold, color: navy });
  });
  y -= 92;
  text("TIME ENTRIES", margin, 10, bold, navy);
  y -= 20;

  for (const entry of input.entries) {
    if (y < 65) newPage();
    const client = entry.projects?.clients?.name || "Unassigned client";
    const project = `${entry.projects?.project_code ? `[${entry.projects.project_code}] ` : ""}${entry.projects?.name || "Unassigned project"}`;
    page.drawText(entry.entry_date, { x: margin, y, size: 7.5, font: bold, color: navy });
    page.drawText(client.slice(0, 24), { x: margin + 75, y, size: 7.5, font: regular, color: slate });
    page.drawText(project.slice(0, 38), { x: margin + 210, y, size: 7.5, font: regular, color: slate });
    page.drawText(formatDecimalHours(Number(entry.hours || 0)), { x: width - margin - 35, y, size: 7.5, font: bold, color: navy });
    y -= 17;
    page.drawLine({ start: { x: margin, y: y + 6 }, end: { x: width - margin, y: y + 6 }, thickness: 0.4, color: rgb(226 / 255, 232 / 255, 240 / 255) });
  }
  return pdf.save();
}

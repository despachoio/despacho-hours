import type { AssetAssignment } from "@/lib/assets/types";

const PAGE_MARGIN = 28;
const HEADER_HEIGHT = 26;
const ROW_HEIGHT = 25;

function pdfSafe(value: unknown) {
  return String(value ?? "-")
    .replaceAll("–", "-")
    .replaceAll("—", "-")
    .replaceAll("·", "-")
    .replaceAll(/[^\x20-\x7E]/g, "?");
}

function dateLabel(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00`));
}

export async function downloadAssignedAssetsPdf(rows: AssetAssignment[]) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageSize: [number, number] = [841.89, 595.28];
  const columns = [
    { label: "Employee Code", width: 70 },
    { label: "Employee Name", width: 112 },
    { label: "Asset Type", width: 82 },
    { label: "Brand / Model", width: 110 },
    { label: "Asset Tag", width: 82 },
    { label: "Serial Number", width: 88 },
    { label: "Issued Date", width: 72 },
    { label: "Condition", width: 65 },
    { label: "Status", width: 65 },
  ];
  const tableWidth = columns.reduce((total, column) => total + column.width, 0);

  const truncate = (value: unknown, width: number, size: number) => {
    const text = pdfSafe(value);
    if (regular.widthOfTextAtSize(text, size) <= width) return text;
    let result = text;
    while (result.length && regular.widthOfTextAtSize(`${result}...`, size) > width) {
      result = result.slice(0, -1);
    }
    return `${result}...`;
  };

  const addPage = () => {
    const page = pdf.addPage(pageSize);
    const { height } = page.getSize();
    page.drawText("DESPACHO INDIA PRIVATE LIMITED", {
      x: PAGE_MARGIN,
      y: height - 34,
      size: 13,
      font: bold,
      color: rgb(21 / 255, 62 / 255, 144 / 255),
    });
    page.drawText("FILTERED ASSIGNED ASSETS", {
      x: PAGE_MARGIN,
      y: height - 55,
      size: 19,
      font: bold,
      color: rgb(15 / 255, 23 / 255, 42 / 255),
    });
    page.drawText(`${rows.length} record${rows.length === 1 ? "" : "s"} | Generated ${dateLabel(new Date().toISOString())}`, {
      x: PAGE_MARGIN,
      y: height - 73,
      size: 8,
      font: regular,
      color: rgb(100 / 255, 116 / 255, 139 / 255),
    });
    page.drawLine({
      start: { x: PAGE_MARGIN, y: height - 84 },
      end: { x: PAGE_MARGIN + tableWidth, y: height - 84 },
      thickness: 1.2,
      color: rgb(21 / 255, 62 / 255, 144 / 255),
    });
    return { page, y: height - 105 };
  };

  const drawHeader = (page: ReturnType<typeof pdf.addPage>, y: number) => {
    page.drawRectangle({
      x: PAGE_MARGIN,
      y: y - HEADER_HEIGHT,
      width: tableWidth,
      height: HEADER_HEIGHT,
      color: rgb(15 / 255, 23 / 255, 42 / 255),
    });
    let x = PAGE_MARGIN;
    columns.forEach((column) => {
      page.drawText(column.label, {
        x: x + 5,
        y: y - 17,
        size: 6.5,
        font: bold,
        color: rgb(1, 1, 1),
      });
      x += column.width;
    });
    return y - HEADER_HEIGHT;
  };

  let { page, y } = addPage();
  y = drawHeader(page, y);
  rows.forEach((row, index) => {
    if (y - ROW_HEIGHT < 35) {
      ({ page, y } = addPage());
      y = drawHeader(page, y);
    }
    if (index % 2 === 1) {
      page.drawRectangle({
        x: PAGE_MARGIN,
        y: y - ROW_HEIGHT,
        width: tableWidth,
        height: ROW_HEIGHT,
        color: rgb(248 / 255, 250 / 255, 252 / 255),
      });
    }
    const values = [
      row.employee?.employee_code,
      row.employee?.name,
      row.asset?.item?.name,
      [row.asset?.brand, row.asset?.model].filter(Boolean).join(" / ") || "-",
      row.asset?.asset_tag,
      row.asset?.serial_number,
      dateLabel(row.issued_date),
      row.condition_at_issue,
      row.status.replaceAll("_", " "),
    ];
    let x = PAGE_MARGIN;
    values.forEach((value, columnIndex) => {
      page.drawText(truncate(value, columns[columnIndex].width - 10, 7), {
        x: x + 5,
        y: y - 16,
        size: 7,
        font: columnIndex < 2 ? bold : regular,
        color: rgb(30 / 255, 41 / 255, 59 / 255),
      });
      x += columns[columnIndex].width;
    });
    page.drawLine({
      start: { x: PAGE_MARGIN, y: y - ROW_HEIGHT },
      end: { x: PAGE_MARGIN + tableWidth, y: y - ROW_HEIGHT },
      thickness: 0.35,
      color: rgb(226 / 255, 232 / 255, 240 / 255),
    });
    y -= ROW_HEIGHT;
  });

  const bytes = await pdf.save();
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const blob = new Blob([buffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Assigned_Assets_${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

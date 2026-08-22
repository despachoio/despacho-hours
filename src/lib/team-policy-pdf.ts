import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export async function stampPolicyPageNumbers(input: Uint8Array | Buffer) {
  const pdf = await PDFDocument.load(input);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const pages = pdf.getPages();
  pages.forEach((page, index) => {
    const label = `Page ${index + 1} of ${pages.length}`;
    const size = 7;
    page.drawText(label, {
      x: page.getWidth() - 38 - font.widthOfTextAtSize(label, size),
      y: 22,
      size,
      font,
      color: rgb(0.392, 0.455, 0.545),
    });
  });
  return pdf.save();
}

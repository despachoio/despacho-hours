function safeFilenamePart(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "-").trim();
}

export function payrollMonthLabel(payrollMonth: string) {
  return new Date(`${payrollMonth.slice(0, 7)}-01T00:00:00Z`).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function payslipFilename(employeeCode: string, payrollMonth: string) {
  return `Payslip_${safeFilenamePart(employeeCode)}_${payrollMonthLabel(payrollMonth)}.pdf`;
}

export function ytdFilename(employeeCode: string, financialYear: string) {
  return `YTD_${safeFilenamePart(employeeCode)}_FY ${safeFilenamePart(financialYear)}.pdf`;
}

export function bankTransferFilename(payrollMonth: string) {
  const date = new Date(`${payrollMonth.slice(0, 7)}-01T00:00:00Z`);
  const label = date.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
  return `OBSalaryFile_${safeFilenamePart(label)}.txt`;
}

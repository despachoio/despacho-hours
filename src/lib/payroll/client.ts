import { supabase } from "@/lib/supabase";

async function token() {
  const session = await supabase.auth.getSession();
  const value = session.data.session?.access_token;
  if (!value) throw new Error("Your session has expired");
  return value;
}

async function downloadResponse(path: string, fallbackFilename: string) {
  const response = await fetch(path, { headers: { authorization: `Bearer ${await token()}` } });
  if (!response.ok) { const body = await response.json().catch(() => null) as { error?: string } | null; throw new Error(body?.error || "Unable to download payroll report"); }
  const disposition = response.headers.get("content-disposition") || "";
  const filename = disposition.match(/filename="([^"]+)"/)?.[1] || fallbackFilename;
  const link = document.createElement("a"); link.href = URL.createObjectURL(await response.blob()); link.download = filename; link.click(); URL.revokeObjectURL(link.href);
}

export async function payrollRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, headers: { "Content-Type": "application/json", authorization: `Bearer ${await token()}`, ...init?.headers } });
  const body = await response.json().catch(() => null) as { error?: string } | T | null;
  if (!response.ok) throw new Error((body as { error?: string } | null)?.error || "Payroll request failed");
  return body as T;
}

export async function downloadPayslip(id: string, filename: string) {
  const response = await fetch(`/api/payroll/payslip/${id}`, { headers: { authorization: `Bearer ${await token()}` } });
  if (!response.ok) { const body = await response.json().catch(() => null) as { error?: string } | null; throw new Error(body?.error || "Unable to download payslip"); }
  const link = document.createElement("a"); link.href = URL.createObjectURL(await response.blob()); link.download = filename; link.click(); URL.revokeObjectURL(link.href);
}

export async function downloadPayrollYtd(financialYear: string, options: { employeeId?: string; fromMonth?: string; toMonth?: string } = {}) {
  const query = new URLSearchParams({ financialYear });
  if (options.employeeId) query.set("employeeId", options.employeeId);
  if (options.fromMonth) query.set("fromMonth", options.fromMonth);
  if (options.toMonth) query.set("toMonth", options.toMonth);
  const response = await fetch(`/api/payroll/ytd?${query}`, { headers: { authorization: `Bearer ${await token()}` } });
  if (!response.ok) { const body = await response.json().catch(() => null) as { error?: string } | null; throw new Error(body?.error || "Unable to download YTD payroll report"); }
  const disposition = response.headers.get("content-disposition") || "";
  const filename = disposition.match(/filename="([^"]+)"/)?.[1] || `YTD_FY ${financialYear}.pdf`;
  const link = document.createElement("a"); link.href = URL.createObjectURL(await response.blob()); link.download = filename; link.click(); URL.revokeObjectURL(link.href);
}

export async function downloadPayrollSummary(financialYear: string, fromMonth: string, toMonth: string, format: "xlsx" | "pdf") {
  const query = new URLSearchParams({ financialYear, fromMonth, toMonth, format });
  await downloadResponse(`/api/payroll/reports/summary?${query}`, `Payroll_Summary_${financialYear}.${format}`);
}

export async function downloadBankTransfer(runId: string) {
  await downloadResponse(`/api/payroll/bank-transfer/${encodeURIComponent(runId)}`, "OBSalaryFile.txt");
}

export async function processPayslipDistribution(entryId: string, action: "process" | "resend" | "regenerate" = "process") {
  return payrollRequest(`/api/payroll/distribution`, { method: "POST", body: JSON.stringify({ entryId, action }) });
}

export async function viewPayslip(id: string) {
  const response = await fetch(`/api/payroll/payslip/${id}`, { headers: { authorization: `Bearer ${await token()}` } });
  if (!response.ok) { const body = await response.json().catch(() => null) as { error?: string } | null; throw new Error(body?.error || "Unable to view payslip"); }
  const url = URL.createObjectURL(await response.blob());
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

import { distributePayslip, distributionStatus } from "@/lib/payroll/distribution";
import { financePayrollOnly, payrollActor } from "@/lib/payroll/server";

export async function GET(request: Request) {
  try {
    const actor = await payrollActor(request);
    financePayrollOnly(actor.role);
    const runId = new URL(request.url).searchParams.get("runId") || "";
    if (!runId) return Response.json({ error: "Payroll run is required" }, { status: 400 });
    return Response.json({ distributions: await distributionStatus(actor.admin, runId) });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Unable to load payslip distribution";
    return Response.json({ error: message }, { status: message === "Unauthorized" ? 401 : 400 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await payrollActor(request);
    financePayrollOnly(actor.role);
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action || "process");
    const entryId = String(body.entryId || "");
    if (!entryId) return Response.json({ error: "Payroll entry is required" }, { status: 400 });
    return Response.json(await distributePayslip(actor, entryId, {
      forceResend: action === "resend",
      forceRegenerate: action === "regenerate",
      sendEmail: action !== "regenerate",
    }));
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Payslip distribution failed";
    return Response.json({ error: message }, { status: message === "Unauthorized" ? 401 : 400 });
  }
}

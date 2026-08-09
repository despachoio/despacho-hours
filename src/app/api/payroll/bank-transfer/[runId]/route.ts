import { exportPayrollBankTransfer } from "@/lib/payroll/server";

export async function GET(request: Request, context: { params: Promise<{ runId: string }> }) {
  try {
    const { runId } = await context.params;
    const file = await exportPayrollBankTransfer(request, runId);
    return new Response(file.content, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${file.filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Unable to generate bank transfer file";
    return Response.json({ error: message }, { status: message === "Unauthorized" ? 401 : 400 });
  }
}

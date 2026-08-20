import { performanceActor } from "@/lib/performance/server";
import { loadAppraisalPolicyConfiguration } from "@/lib/team-policy-server";

export async function GET(request: Request) {
  try {
    const actor = await performanceActor(request);
    return Response.json(await loadAppraisalPolicyConfiguration(actor.admin), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Unable to load policy configuration";
    return Response.json({ error: message }, { status: message === "Unauthorized" ? 401 : 400 });
  }
}

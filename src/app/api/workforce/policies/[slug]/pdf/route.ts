import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { PolicyPdfDocument } from "@/components/team/PolicyPdfDocument";
import { performanceActor } from "@/lib/performance/server";
import { loadCompanyLogo, loadCompanySettings } from "@/lib/settings/companySettings";
import { buildPolicyDocument, findTeamPolicy } from "@/lib/team-policies";
import { loadAppraisalPolicyConfiguration } from "@/lib/team-policy-server";
import { stampPolicyPageNumbers } from "@/lib/team-policy-pdf";

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const actor = await performanceActor(request);
    const { slug } = await context.params;
    const policy = findTeamPolicy(slug);
    if (!policy) return Response.json({ error: "Policy not found" }, { status: 404 });
    const [company, config] = await Promise.all([
      loadCompanySettings(actor.admin),
      policy.contentSource === "reviews-settings" ? loadAppraisalPolicyConfiguration(actor.admin) : Promise.resolve(undefined),
    ]);
    const logo = await loadCompanyLogo({ ...company, invoice_logo_url: "/despacho-logo-full.png" });
    const policyDocument = buildPolicyDocument(policy, config);
    const document = createElement(PolicyPdfDocument, { document: policyDocument, logoSrc: logo.dataUrl }) as ReactElement<DocumentProps>;
    const pdf = await stampPolicyPageNumbers(await renderToBuffer(document));
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${policy.slug}-v${config?.settings.policy_version || policy.version}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Unable to generate policy PDF";
    return Response.json({ error: message }, { status: message === "Unauthorized" ? 401 : 400 });
  }
}

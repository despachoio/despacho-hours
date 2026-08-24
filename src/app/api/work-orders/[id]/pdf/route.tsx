import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { WorkOrderPdfDocument } from "@/components/work-orders/WorkOrderPdfDocument";
import { workOrderActor } from "@/lib/work-orders/server";
import {
  loadCompanyLogo,
  loadCompanySettings,
} from "@/lib/settings/companySettings";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await workOrderActor(request);
    const { id } = await params;
    const url = new URL(request.url);
    const requested = Number(url.searchParams.get("version") || 0);
    let q = actor.admin
      .from("work_order_versions")
      .select("*")
      .eq("work_order_id", id)
      .order("version_number", { ascending: false })
      .limit(1);
    if (requested)
      q = actor.admin
        .from("work_order_versions")
        .select("*")
        .eq("work_order_id", id)
        .eq("version_number", requested)
        .limit(1);
    const version = await q.single();
    if (version.error)
      throw new Error("Generated Work Order version not found");
    const company = await loadCompanySettings(actor.admin);
    const logo = await loadCompanyLogo({
      ...company,
      invoice_logo_url: "/despacho-logo-full.png",
    });
    const doc = createElement(WorkOrderPdfDocument, {
      logoSrc: logo.dataUrl,
      snapshot: version.data.snapshot_json,
      version: version.data.version_number,
    }) as ReactElement<DocumentProps>;
    const pdf = await renderToBuffer(doc);
    await actor.admin
      .from("work_order_audit_log")
      .insert({
        work_order_id: id,
        version_id: version.data.id,
        action: "pdf_downloaded",
        actor_user_id: actor.userId,
        actor_role: actor.role,
      });
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Work_Order_${version.data.snapshot_json?.workOrder?.work_order_number || id}_v${version.data.version_number}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (cause) {
    const message =
      cause instanceof Error ? cause.message : "Unable to download Work Order";
    return Response.json(
      {
        error:
          message === "Forbidden"
            ? "You do not have permission to access Work Orders."
            : message,
      },
      {
        status:
          message === "Unauthorized"
            ? 401
            : message === "Forbidden"
              ? 403
              : 400,
      },
    );
  }
}

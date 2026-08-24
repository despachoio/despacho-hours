import {
  changeWorkOrderStatus,
  createClientFromWorkOrder,
  createProjectFromWorkOrder,
  createWorkOrderRevision,
  deleteWorkOrder,
  loadWorkOrder,
  reserveWorkOrderNumber,
  saveWorkOrder,
  searchWorkOrders,
  workOrderActor,
  workOrderBootstrap,
} from "@/lib/work-orders/server";
import type { WorkOrderInput } from "@/lib/work-orders/types";
import type { WorkOrderStatus } from "@/lib/work-orders/access";

function responseError(cause: unknown) {
  const message =
    cause instanceof Error ? cause.message : "Work Order operation failed";
  const status =
    message === "Unauthorized"
      ? 401
      : message === "Forbidden" || message.includes("access required")
        ? 403
        : 400;
  return Response.json(
    {
      error:
        status === 403
          ? "You do not have permission to access Work Orders."
          : message,
    },
    { status },
  );
}
export async function GET(request: Request) {
  try {
    await workOrderActor(request);
    const url = new URL(request.url),
      mode = url.searchParams.get("mode") || "search";
    if (mode === "access") return Response.json({ allowed: true });
    if (mode === "bootstrap")
      return Response.json(await workOrderBootstrap(request));
    if (mode === "detail")
      return Response.json(
        await loadWorkOrder(request, String(url.searchParams.get("id") || "")),
      );
    return Response.json(await searchWorkOrders(request, url.searchParams));
  } catch (cause) {
    return responseError(cause);
  }
}
export async function POST(request: Request) {
  try {
    await workOrderActor(request);
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action || "");
    if (action === "reserve")
      return Response.json(
        await reserveWorkOrderNumber(request, body.newClient === true),
      );
    if (action === "save" || action === "generate")
      return Response.json(
        await saveWorkOrder(
          request,
          body.input as WorkOrderInput,
          action === "generate",
        ),
      );
    if (action === "status")
      return Response.json(
        await changeWorkOrderStatus(
          request,
          String(body.id || ""),
          String(body.status || "") as WorkOrderStatus,
        ),
      );
    if (action === "revision")
      return Response.json(
        await createWorkOrderRevision(request, String(body.id || "")),
      );
    if (action === "delete")
      return Response.json(
        await deleteWorkOrder(request, String(body.id || "")),
      );
    if (action === "create_client")
      return Response.json(
        await createClientFromWorkOrder(
          request,
          String(body.id || ""),
          body.existingClientId ? String(body.existingClientId) : undefined,
        ),
      );
    if (action === "create_project")
      return Response.json(
        await createProjectFromWorkOrder(
          request,
          String(body.id || ""),
          String(body.projectCode || ""),
          String(body.projectName || ""),
        ),
      );
    throw new Error("Unsupported Work Order action");
  } catch (cause) {
    return responseError(cause);
  }
}

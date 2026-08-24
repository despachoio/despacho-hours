import { canAccessWorkOrders } from "@/lib/roles";

export const WORK_ORDER_STATUSES = [
  "draft",
  "generated",
  "sent",
  "signed",
  "onboarded",
  "cancelled",
] as const;
export type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number];

const TRANSITIONS: Record<WorkOrderStatus, readonly WorkOrderStatus[]> = {
  draft: ["generated", "cancelled"],
  generated: ["sent", "cancelled"],
  sent: ["signed", "cancelled"],
  signed: ["onboarded"],
  onboarded: [],
  cancelled: [],
};

export function assertWorkOrderAccess(role: unknown) {
  if (!canAccessWorkOrders(role)) throw new Error("Forbidden");
}

export function canTransitionWorkOrder(
  from: WorkOrderStatus,
  to: WorkOrderStatus,
) {
  return TRANSITIONS[from].includes(to);
}

export function workOrderNumber(sequence: number) {
  if (!Number.isInteger(sequence) || sequence < 1)
    throw new Error("Invalid Work Order sequence");
  return String(sequence).padStart(4, "0");
}

export function customerIdForSequence(sequence: number) {
  return 1000 + sequence;
}

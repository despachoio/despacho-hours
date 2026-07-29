import KairoBadge from "@/components/ui/KairoBadge";

const labels: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
  cancellation_requested: "Cancellation Requested",
  cancellation_rejected: "Cancellation Rejected",
  cancelled_by_admin: "Cancelled by Admin",
};

export default function TimeOffStatusBadge({ status }: { status: string }) {
  const color = status === "approved"
    ? "green"
    : status === "rejected" || status === "cancelled_by_admin"
      ? "red"
      : status === "pending" || status === "cancellation_requested"
        ? "yellow"
        : "gray";
  return <KairoBadge color={color}>{labels[status] || status}</KairoBadge>;
}

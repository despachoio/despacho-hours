import { ReactNode } from "react";

type Props = {
  children: ReactNode;
  color?: "gray" | "green" | "red" | "yellow" | "blue";
};

export default function KairoBadge({
  children,
  color = "gray",
}: Props) {
  const styles = {
    gray: "bg-slate-100 text-slate-700 ring-slate-200",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    red: "bg-red-50 text-red-700 ring-red-200",
    yellow: "bg-amber-50 text-amber-700 ring-amber-200",
    blue: "bg-blue-50 text-blue-700 ring-blue-200",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ring-1 ring-inset ${styles[color]}`}
    >
      {children}
    </span>
  );
}

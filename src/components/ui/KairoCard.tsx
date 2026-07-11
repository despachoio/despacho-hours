import { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
};

export default function KairoCard({
  children,
  className = "",
}: Props) {
  return (
    <div
      className={`rounded-3xl border border-slate-200 bg-white shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}
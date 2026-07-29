import type { ReactNode } from "react";
import KairoCard from "@/components/ui/KairoCard";

export default function TimeOffPremiumCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <KairoCard
      className={`relative border-white/90 bg-gradient-to-br from-white via-white to-blue-50/45 shadow-[0_22px_58px_-40px_rgba(15,23,42,.7)] ring-1 ring-inset ring-slate-100/70 transition-shadow duration-300 before:pointer-events-none before:absolute before:inset-x-6 before:top-0 before:z-10 before:h-1 before:rounded-b-full before:bg-gradient-to-r before:from-blue-700 before:via-cyan-400 before:to-violet-500 before:content-[''] hover:shadow-[0_28px_68px_-42px_rgba(21,62,144,.5)] [&_thead]:bg-slate-950 [&_thead]:text-slate-200 [&_tbody_tr]:transition-colors [&_tbody_tr:nth-child(even)]:bg-slate-50/50 [&_tbody_tr:hover]:bg-blue-50/55 ${className}`}
    >
      {children}
    </KairoCard>
  );
}

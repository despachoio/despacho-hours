import type { ReactNode } from "react";

export function DashboardPanelHeader({
  eyebrow,
  title,
  description,
  trailing,
}: {
  eyebrow: string;
  title: string;
  description: string;
  trailing?: ReactNode;
}) {
  return (
    <header className="relative min-h-[129px] overflow-hidden border-b border-slate-100 bg-gradient-to-r from-blue-50/80 via-white to-emerald-50/60 px-6 py-6 sm:px-7">
      <div className="absolute -right-10 -top-16 h-40 w-40 rounded-full bg-cyan-200/25 blur-3xl" />
      <div className="relative flex min-h-[80px] flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_5px_rgba(16,185,129,0.12)]" />
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#153E90]">
              {eyebrow}
            </p>
          </div>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
            {title}
          </h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        {trailing ? <div className="shrink-0">{trailing}</div> : null}
      </div>
    </header>
  );
}

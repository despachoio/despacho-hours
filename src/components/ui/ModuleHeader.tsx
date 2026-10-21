import type { ReactNode } from "react";

type ModuleHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export default function ModuleHeader({
  eyebrow,
  title,
  description,
  actions,
  footer,
  className = "",
}: ModuleHeaderProps) {
  return (
    <section
      className={`overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_18px_45px_-35px_rgba(15,23,42,.45)] ${className}`}
    >
      <header className="bg-gradient-to-r from-[var(--kairo-accent-soft)] via-white to-[var(--kairo-card-accent)] px-7 py-7">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--kairo-primary)]">
          {eyebrow}
        </p>
        <div className="mt-2 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-3xl font-bold text-slate-950">{title}</h2>
            <p className="mt-2 text-sm text-slate-500">{description}</p>
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      </header>
      {footer}
    </section>
  );
}

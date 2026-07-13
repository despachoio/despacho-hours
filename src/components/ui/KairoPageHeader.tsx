import { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
};

export default function KairoPageHeader({
  title,
  subtitle,
  action,
}: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-950">
          {title}
        </h1>

        {subtitle && (
          <p className="mt-2 leading-relaxed text-slate-500">
            {subtitle}
          </p>
        )}
      </div>

      {action}
    </div>
  );
}

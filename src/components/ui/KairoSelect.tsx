import { SelectHTMLAttributes } from "react";

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
};

export default function KairoSelect({
  label,
  className = "",
  children,
  ...props
}: Props) {
  return (
    <div>
      {label && (
        <label className="mb-2 block text-sm font-semibold text-slate-600">
          {label}
        </label>
      )}

      <select
        {...props}
        className={`w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900 ${className}`}
      >
        {children}
      </select>
    </div>
  );
}
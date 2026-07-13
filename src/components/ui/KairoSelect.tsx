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
        <label htmlFor={props.id} className="mb-2 block text-sm font-semibold text-slate-700">
          {label}
        </label>
      )}

      <select
        {...props}
        className={`min-h-11 w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 shadow-sm outline-none transition-colors duration-200 focus:border-[#153E90] focus:ring-2 focus:ring-[#153E90]/15 disabled:bg-slate-100 disabled:text-slate-500 ${className}`}
      >
        {children}
      </select>
    </div>
  );
}

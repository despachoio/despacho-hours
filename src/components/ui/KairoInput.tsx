import { InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
};

export default function KairoInput({
  label,
  className = "",
  ...props
}: Props) {
  return (
    <div>
      {label && (
        <label htmlFor={props.id} className="mb-2 block text-sm font-semibold text-slate-700">
          {label}
        </label>
      )}

      <input
        {...props}
        className={`min-h-11 w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 shadow-sm outline-none transition-colors duration-200 placeholder:text-slate-400 focus:border-[var(--kairo-primary)] focus:ring-2 focus:ring-[var(--kairo-focus-ring)] disabled:bg-slate-100 disabled:text-slate-500 ${className}`}
      />
    </div>
  );
}

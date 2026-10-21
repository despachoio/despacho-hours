import { TextareaHTMLAttributes } from "react";

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
};

export default function KairoTextarea({
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

      <textarea
        {...props}
        className={`min-h-28 w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition-colors duration-200 placeholder:text-slate-400 focus:border-[var(--kairo-primary)] focus:ring-2 focus:ring-[var(--kairo-focus-ring)] disabled:bg-slate-100 disabled:text-slate-500 ${className}`}
      />
    </div>
  );
}

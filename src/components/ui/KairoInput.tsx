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
        <label className="mb-2 block text-sm font-semibold text-slate-600">
          {label}
        </label>
      )}

      <input
        {...props}
        className={`w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900 ${className}`}
      />
    </div>
  );
}
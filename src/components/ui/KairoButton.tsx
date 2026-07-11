import { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
};

export default function KairoButton({
  variant = "primary",
  className = "",
  children,
  ...props
}: Props) {
  const styles = {
    primary:
      "bg-slate-950 text-white hover:bg-slate-800",

    secondary:
      "border border-slate-200 bg-white hover:bg-slate-50",

    danger:
      "bg-red-600 text-white hover:bg-red-700",
  };

  return (
    <button
      {...props}
      className={`rounded-2xl px-5 py-3 text-sm font-semibold transition ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
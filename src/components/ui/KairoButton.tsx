import { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "brown";
};

export default function KairoButton({
  variant = "primary",
  className = "",
  children,
  ...props
}: Props) {
  const styles = {
    primary:
      "bg-[#0F172A] text-white shadow-sm hover:bg-[#153E90]",

    secondary:
      "border border-slate-300 bg-white text-slate-800 shadow-sm hover:bg-slate-50",

    danger:
      "bg-[#DC2626] text-white shadow-sm hover:bg-red-700",

    brown:
      "bg-[#5A2D1F] text-white shadow-sm hover:bg-[#442116]",
  };

  return (
    <button
      {...props}
      className={`rounded-xl px-5 py-3 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#153E90]/30 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

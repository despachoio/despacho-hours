import type { Metadata } from "next";

export const metadata: Metadata = { title: "Payroll" };

export default function PayrollModuleLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}

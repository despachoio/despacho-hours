import type { Metadata } from "next";

export const metadata: Metadata = { title: "Invoices" };

export default function InvoicesModuleLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}

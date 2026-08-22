import type { Metadata } from "next";

export const metadata: Metadata = { title: "Invoice Payment" };

export default function InvoicePaymentLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}

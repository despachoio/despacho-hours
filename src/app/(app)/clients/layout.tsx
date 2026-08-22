import type { Metadata } from "next";

export const metadata: Metadata = { title: "Accounts" };

export default function LegacyClientsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}

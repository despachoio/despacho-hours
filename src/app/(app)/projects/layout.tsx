import type { Metadata } from "next";

export const metadata: Metadata = { title: "Accounts" };

export default function LegacyProjectsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}

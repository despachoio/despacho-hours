import type { Metadata } from "next";

export const metadata: Metadata = { title: "Time Off" };

export default function TimeOffModuleLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}

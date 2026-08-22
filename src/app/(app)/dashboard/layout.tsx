import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardModuleLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}

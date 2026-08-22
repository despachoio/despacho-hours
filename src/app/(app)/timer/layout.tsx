import type { Metadata } from "next";

export const metadata: Metadata = { title: "Time" };

export default function TimeModuleLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}

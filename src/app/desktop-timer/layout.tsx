import type { Metadata } from "next";

export const metadata: Metadata = { title: "Desktop Timer" };

export default function DesktopTimerLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}

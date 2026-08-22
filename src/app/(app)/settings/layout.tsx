import type { Metadata } from "next";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsModuleLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}

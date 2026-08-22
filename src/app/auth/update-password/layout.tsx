import type { Metadata } from "next";

export const metadata: Metadata = { title: "Update Password" };

export default function UpdatePasswordLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}

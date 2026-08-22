import type { Metadata } from "next";

export const metadata: Metadata = { title: "Signing In" };

export default function AuthCallbackLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}

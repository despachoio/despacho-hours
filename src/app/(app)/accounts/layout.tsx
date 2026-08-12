import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Accounts | Kairo",
  description: "Manage client accounts, projects and service delivery.",
};

export default function AccountsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}

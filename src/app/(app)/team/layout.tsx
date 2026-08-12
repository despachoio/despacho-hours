import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Workforce | Kairo",
  description:
    "Manage your organization's workforce, reporting structure, approvals and company policies.",
};

export default function WorkforceLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}

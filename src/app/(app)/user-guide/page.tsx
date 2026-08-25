import type { Metadata } from "next";
import UserGuideWorkspace from "@/components/user-guide/UserGuideWorkspace";

export const metadata: Metadata = {
  title: "User Guide",
  description: "Role-aware help and documentation for Kairo.",
};

export default function UserGuidePage() {
  return <UserGuideWorkspace />;
}

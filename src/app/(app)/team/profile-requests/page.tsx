import Link from "next/link";
import ProfileApprovals from "@/components/team/ProfileApprovals";

export default function ProfileRequestsPage() {
  return <main className="min-h-screen bg-[#F8FAFC] px-5 py-7 sm:px-8"><div className="mx-auto max-w-[1500px]"><Link href="/team" className="mb-5 inline-block text-sm font-bold text-slate-500 hover:text-[#153E90]">← Back to Workforce</Link><ProfileApprovals/></div></main>;
}

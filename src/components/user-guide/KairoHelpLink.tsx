import Link from "next/link";

export default function KairoHelpLink({
  section,
  role,
  children,
  className = "",
}: {
  section?: string;
  role?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const query = new URLSearchParams();
  if (section) query.set("section", section);
  if (role) query.set("role", role.trim().toLowerCase().replace(/\s+/g, "_"));
  const suffix = query.size ? `?${query.toString()}` : "";
  return (
    <Link
      href={`/user-guide${suffix}`}
      className={`font-bold text-[#153E90] transition hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 ${className}`}
    >
      {children || "View guide →"}
    </Link>
  );
}

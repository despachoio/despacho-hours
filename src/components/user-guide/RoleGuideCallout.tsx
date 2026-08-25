import KairoHelpLink from "@/components/user-guide/KairoHelpLink";

export default function RoleGuideCallout({
  role,
  compact = false,
}: {
  role: string;
  compact?: boolean;
}) {
  return (
    <aside
      className={`rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-cyan-50 ${compact ? "p-3" : "p-5"}`}
    >
      <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#153E90]">
        {role}
      </p>
      <p className={`${compact ? "mt-1 text-xs" : "mt-2 text-sm"} font-semibold text-slate-700`}>
        You&apos;re using Kairo as {role}.
      </p>
      <KairoHelpLink
        role={role}
        className={`mt-2 inline-flex ${compact ? "text-xs" : "text-sm"}`}
      >
        View what you can do →
      </KairoHelpLink>
    </aside>
  );
}

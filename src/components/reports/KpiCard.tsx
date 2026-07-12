type Props = {
  label: string;
  value: string;
  note?: string;
  comparison?: { text: string; tone: "positive" | "negative" | "neutral" };
  accent?: "blue" | "green" | "amber" | "violet";
};

export default function KpiCard({
  label,
  value,
  note,
  comparison,
  accent = "blue",
}: Props) {
  const colors = {
    blue: "bg-blue-50 text-[#153E90]",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    violet: "bg-violet-50 text-violet-700",
  }[accent];
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
            {label}
          </p>
          <p className="mt-3 text-2xl font-bold tracking-tight text-slate-950">
            {value}
          </p>
        </div>
        <span
          className={`rounded-xl px-2.5 py-1.5 text-xs font-bold ${colors}`}
        >
          ●
        </span>
      </div>
      {comparison ? (
        <p
          className={`mt-3 text-xs font-bold ${comparison.tone === "positive" ? "text-emerald-600" : comparison.tone === "negative" ? "text-red-600" : "text-slate-400"}`}
        >
          {comparison.text}
        </p>
      ) : note ? (
        <p className="mt-3 text-xs font-medium text-slate-400">{note}</p>
      ) : null}
    </article>
  );
}

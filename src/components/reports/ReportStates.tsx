export function ReportLoadingState() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="h-32 animate-pulse rounded-3xl border border-slate-200 bg-white"
          />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="h-80 animate-pulse rounded-3xl bg-white" />
        <div className="h-80 animate-pulse rounded-3xl bg-white" />
      </div>
    </div>
  );
}
export function ReportEmptyState({ onClear }: { onClear: () => void }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
      <h2 className="text-xl font-bold text-slate-950">
        No report data found.
      </h2>
      <p className="mt-2 text-sm text-slate-500">
        Adjust your filters or choose a different period.
      </p>
      <button
        type="button"
        onClick={onClear}
        className="mt-5 rounded-xl bg-[#153E90] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#0F172A] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#153E90]/20"
      >
        Clear Filters
      </button>
    </div>
  );
}

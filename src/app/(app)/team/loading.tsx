export default function WorkforceLoading() {
  return (
    <main className="min-h-screen bg-[#F8FAFC] px-5 py-7 sm:px-8">
      <div className="mx-auto max-w-[1500px]">
        <div className="h-56 animate-pulse rounded-[2rem] bg-[#0F172A]" />
        <div className="relative z-10 mx-4 -mt-4 h-16 animate-pulse rounded-2xl bg-white shadow-lg" />
        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="h-40 animate-pulse rounded-3xl bg-white" />
          ))}
        </div>
      </div>
    </main>
  );
}

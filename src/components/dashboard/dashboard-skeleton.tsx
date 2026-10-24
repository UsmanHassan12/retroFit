/** Shimmer placeholder shown while a dashboard route streams in. */
export function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-[1120px] animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="h-10 w-72 rounded-lg bg-line-soft" />
      <div className="mt-3 h-5 w-96 max-w-full rounded bg-line-soft" />
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-36 rounded-2xl bg-white shadow-card" />
        ))}
      </div>
      <div className="mt-8 h-80 rounded-2xl bg-white shadow-card" />
    </div>
  );
}

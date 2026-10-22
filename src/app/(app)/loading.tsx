export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-lg bg-slate-200/70" />)}
      </div>
      <div className="h-72 animate-pulse rounded-lg bg-slate-200/70" />
    </div>
  );
}

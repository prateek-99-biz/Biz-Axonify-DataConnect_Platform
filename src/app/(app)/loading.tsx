export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="glass h-32 animate-pulse" />)}
      </div>
      <div className="glass h-72 animate-pulse" />
    </div>
  );
}

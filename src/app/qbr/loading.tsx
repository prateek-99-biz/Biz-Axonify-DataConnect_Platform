export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <div className="glass h-16 w-96 max-w-full animate-pulse" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => <div key={i} className="glass h-24 animate-pulse" />)}
      </div>
      <div className="glass h-80 animate-pulse" />
    </div>
  );
}

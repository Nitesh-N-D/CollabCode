export function LoadingSkeleton({ kind = "page" }: { kind?: "page" | "room" }) {
  return <div className={`loading-skeleton ${kind}`} role="status" aria-label="Loading content">
    <div className="skeleton-line title" /><div className="skeleton-line copy" />
    <div className="skeleton-grid">{Array.from({ length: kind === "room" ? 6 : 3 }, (_, index) => <div className="skeleton-card" key={index}><i /><b /><small /></div>)}</div>
  </div>;
}

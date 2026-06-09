export function AlertBadge({ score }) {
  if (score >= 80) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs font-semibold text-yellow-400 border border-yellow-500/30">
        <span className="h-1.5 w-1.5 rounded-full bg-yellow-400 animate-pulse" />
        Alta confluencia
      </span>
    );
  }
  return null;
}

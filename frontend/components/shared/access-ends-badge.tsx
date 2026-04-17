'use client';

export function AccessEndsBadge({ effectiveEnd }: { effectiveEnd: string | null | undefined }) {
  if (!effectiveEnd) return <span className="text-gray-400">\u2014</span>;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(effectiveEnd);
  const days = Math.ceil((d.getTime() - today.getTime()) / 86_400_000);
  let color = 'bg-green-100 text-green-800';
  if (days <= 0) color = 'bg-gray-200 text-gray-600';
  else if (days <= 7) color = 'bg-red-100 text-red-800';
  else if (days <= 30) color = 'bg-amber-100 text-amber-800';
  const label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const suffix = days > 0 ? ` (${days}d)` : days === 0 ? ' (today)' : ' (expired)';
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${color}`}>
      {label}{suffix}
    </span>
  );
}

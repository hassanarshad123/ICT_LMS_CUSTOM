'use client';

interface QuotaItem {
  name: string;
  slug: string;
  usersUsedPct: number;
  storageUsedPct: number;
  videoUsedPct: number;
}

interface SAHorizontalBarProps {
  data: QuotaItem[];
}

function BarSegment({ label, pct }: { label: string; pct: number }) {
  const color =
    pct >= 90 ? 'bg-red-500' :
    pct >= 70 ? 'bg-amber-500' :
    'bg-emerald-500';

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-zinc-500 w-14 shrink-0">{label}</span>
      <div className="flex-1 bg-zinc-100 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all ${color}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className={`text-xs font-medium w-10 text-right ${
        pct >= 90 ? 'text-red-600' : pct >= 70 ? 'text-amber-600' : 'text-zinc-600'
      }`}>
        {pct}%
      </span>
    </div>
  );
}

export function SAHorizontalBar({ data }: SAHorizontalBarProps) {
  if (data.length === 0) {
    return <p className="text-sm text-zinc-500 text-center py-8">No quota pressure detected</p>;
  }

  return (
    <div className="space-y-4">
      {data.map((item) => (
        <div key={item.slug} className="space-y-1.5">
          <div className="text-sm font-medium text-zinc-900">{item.name}</div>
          <BarSegment label="Users" pct={item.usersUsedPct} />
          <BarSegment label="Storage" pct={item.storageUsedPct} />
          <BarSegment label="Video" pct={item.videoUsedPct} />
        </div>
      ))}
    </div>
  );
}

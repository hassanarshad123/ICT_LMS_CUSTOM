'use client';

const periods = [
  { label: '7d', value: 7 },
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
] as const;

interface PeriodSelectorProps {
  value: number;
  onChange: (period: number) => void;
}

export function SAPeriodSelector({ value, onChange }: PeriodSelectorProps) {
  return (
    <div className="flex gap-1 bg-zinc-100 rounded-lg p-0.5">
      {periods.map((p) => (
        <button
          key={p.value}
          onClick={() => onChange(p.value)}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
            value === p.value
              ? 'bg-[#1A1A1A] text-white shadow-sm'
              : 'text-zinc-600 hover:text-zinc-900'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

'use client';

import { TrendingUp, TrendingDown, Minus, type LucideIcon } from 'lucide-react';

interface KpiCardProps {
  label: string;
  value: string | number;
  previousValue?: number;
  currentValue?: number;
  icon: LucideIcon;
  color: string;
}

function getTrend(current?: number, previous?: number) {
  if (current === undefined || previous === undefined || previous === 0) {
    return { pct: null, direction: 'flat' as const };
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct > 0) return { pct, direction: 'up' as const };
  if (pct < 0) return { pct, direction: 'down' as const };
  return { pct: 0, direction: 'flat' as const };
}

export function SAKpiCard({ label, value, previousValue, currentValue, icon: Icon, color }: KpiCardProps) {
  const trend = getTrend(currentValue, previousValue);

  return (
    <div className="bg-white rounded-2xl p-5 border border-zinc-200">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-zinc-500">{label}</span>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
          <Icon size={18} className="text-white" />
        </div>
      </div>
      <div className="text-2xl font-bold text-zinc-900">{value}</div>
      {trend.pct !== null && (
        <div className="flex items-center gap-1 mt-1.5">
          {trend.direction === 'up' && <TrendingUp size={14} className="text-green-600" />}
          {trend.direction === 'down' && <TrendingDown size={14} className="text-red-500" />}
          {trend.direction === 'flat' && <Minus size={14} className="text-zinc-400" />}
          <span className={`text-xs font-medium ${
            trend.direction === 'up' ? 'text-green-600' :
            trend.direction === 'down' ? 'text-red-500' : 'text-zinc-400'
          }`}>
            {trend.direction === 'up' ? '+' : ''}{trend.pct}%
          </span>
          <span className="text-xs text-zinc-400">vs prev period</span>
        </div>
      )}
    </div>
  );
}

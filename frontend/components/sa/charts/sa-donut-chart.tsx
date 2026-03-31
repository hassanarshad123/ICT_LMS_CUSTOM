'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { SA_PLAN_COLORS, SA_CHART_STYLE } from './sa-chart-theme';

interface DonutEntry {
  name: string;
  value: number;
}

interface SADonutChartProps {
  data: DonutEntry[];
  height?: number;
}

export function SADonutChart({ data, height = 280 }: SADonutChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={65}
            outerRadius={95}
            paddingAngle={3}
            dataKey="value"
            strokeWidth={0}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={SA_PLAN_COLORS[entry.name] || '#6B7280'} />
            ))}
          </Pie>
          <Tooltip {...SA_CHART_STYLE.tooltip} />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-center">
          <div className="text-2xl font-bold text-zinc-900">{total}</div>
          <div className="text-xs text-zinc-500">Total</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center mt-2">
        {data.map((entry) => (
          <div key={entry.name} className="flex items-center gap-1.5">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: SA_PLAN_COLORS[entry.name] || '#6B7280' }}
            />
            <span className="text-xs text-zinc-600 capitalize">{entry.name}</span>
            <span className="text-xs font-medium text-zinc-900">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

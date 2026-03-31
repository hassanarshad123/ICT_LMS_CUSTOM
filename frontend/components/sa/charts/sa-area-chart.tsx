'use client';

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { SA_COLORS, SA_CHART_STYLE } from './sa-chart-theme';

interface SAAreaChartProps {
  data: Array<{ date: string; [key: string]: any }>;
  dataKey: string;
  secondaryKey?: string;
  height?: number;
}

export function SAAreaChart({ data, dataKey, secondaryKey, height = 280 }: SAAreaChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="saGrad1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={SA_COLORS.primary} stopOpacity={0.3} />
            <stop offset="95%" stopColor={SA_COLORS.primary} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="saGrad2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={SA_COLORS.secondary} stopOpacity={0.3} />
            <stop offset="95%" stopColor={SA_COLORS.secondary} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={SA_CHART_STYLE.grid.stroke} />
        <XAxis
          dataKey="date"
          tick={SA_CHART_STYLE.axis}
          tickFormatter={(v) => {
            const d = new Date(v);
            return `${d.getDate()}/${d.getMonth() + 1}`;
          }}
        />
        <YAxis tick={SA_CHART_STYLE.axis} allowDecimals={false} />
        <Tooltip {...SA_CHART_STYLE.tooltip} />
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={SA_COLORS.primary}
          strokeWidth={2}
          fill="url(#saGrad1)"
        />
        {secondaryKey && (
          <Area
            type="monotone"
            dataKey={secondaryKey}
            stroke={SA_COLORS.secondary}
            strokeWidth={2}
            fill="url(#saGrad2)"
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
}

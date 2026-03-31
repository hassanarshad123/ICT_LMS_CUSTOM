'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { SA_COLORS, SA_CHART_STYLE } from './sa-chart-theme';

interface SABarChartProps {
  data: Array<{ name: string; value: number }>;
  height?: number;
  color?: string;
  layout?: 'horizontal' | 'vertical';
}

export function SABarChart({
  data,
  height = 280,
  color = SA_COLORS.primary,
  layout = 'vertical',
}: SABarChartProps) {
  if (layout === 'horizontal') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={SA_CHART_STYLE.grid.stroke} horizontal={false} />
          <XAxis type="number" tick={SA_CHART_STYLE.axis} />
          <YAxis
            type="category"
            dataKey="name"
            tick={SA_CHART_STYLE.axis}
            width={100}
            tickFormatter={(v: string) => v.length > 14 ? v.slice(0, 14) + '...' : v}
          />
          <Tooltip {...SA_CHART_STYLE.tooltip} />
          <Bar dataKey="value" fill={color} radius={[0, 6, 6, 0]} barSize={20} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={SA_CHART_STYLE.grid.stroke} />
        <XAxis
          dataKey="name"
          tick={SA_CHART_STYLE.axis}
          tickFormatter={(v: string) => v.length > 10 ? v.slice(0, 10) + '...' : v}
        />
        <YAxis tick={SA_CHART_STYLE.axis} allowDecimals={false} />
        <Tooltip {...SA_CHART_STYLE.tooltip} />
        <Bar dataKey="value" fill={color} radius={[6, 6, 0, 0]} barSize={32} />
      </BarChart>
    </ResponsiveContainer>
  );
}

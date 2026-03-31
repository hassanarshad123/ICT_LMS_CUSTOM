export const SA_COLORS = {
  primary: '#C5D86D',
  secondary: '#6B9BD2',
  tertiary: '#E07A5F',
  quaternary: '#8B5CF6',
  quinary: '#F59E0B',
  muted: '#6B7280',
} as const;

export const SA_PLAN_COLORS: Record<string, string> = {
  free: '#6B7280',
  basic: '#6B9BD2',
  pro: '#C5D86D',
  enterprise: '#8B5CF6',
};

export const SA_CHART_STYLE = {
  grid: { stroke: '#e4e4e7' },
  axis: { fontSize: 11, fill: '#71717a' },
  tooltip: {
    contentStyle: {
      backgroundColor: '#fafafa',
      border: '1px solid #e4e4e7',
      borderRadius: '12px',
      fontSize: '13px',
    },
  },
} as const;

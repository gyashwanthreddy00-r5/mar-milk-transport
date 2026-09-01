import { formatCurrency } from '@/lib/calc';

interface BarChartProps {
  data: { label: string; value: number; color?: string }[];
  currency?: string;
  height?: number;
}

export function BarChart({ data, currency = '₹', height = 220 }: BarChartProps) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center text-sm text-slate-400" style={{ height }}>
        No data
      </div>
    );
  }
  const maxVal = Math.max(...data.map((d) => Math.abs(d.value)), 1);
  const chartHeight = height - 40;

  return (
    <div className="w-full" style={{ height }}>
      <div className="flex items-end justify-between gap-2" style={{ height: chartHeight }}>
        {data.map((d, i) => {
          const h = (Math.abs(d.value) / maxVal) * chartHeight;
          return (
            <div key={i} className="flex flex-1 flex-col items-center justify-end gap-2">
              <div className="text-xs font-medium text-slate-600">
                {d.value < 0 ? '-' : ''}
                {formatCurrency(d.value, currency).replace(`${currency}`, '')}
              </div>
              <div
                className={`w-full max-w-[48px] rounded-t-lg transition-all duration-300 hover:opacity-80 ${
                  d.color || 'bg-gradient-to-t from-sky-500 to-sky-400'
                }`}
                style={{ height: Math.max(h, 4) }}
                title={`${d.label}: ${formatCurrency(d.value, currency)}`}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between gap-2">
        {data.map((d, i) => (
          <div key={i} className="flex-1 text-center">
            <span className="block truncate text-xs text-slate-500">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface DonutChartProps {
  segments: { label: string; value: number; color: string }[];
  size?: number;
  currency?: string;
}

export function DonutChart({ segments, size = 180, currency = '₹' }: DonutChartProps) {
  const total = segments.reduce((s, seg) => s + Math.abs(seg.value), 0);
  const radius = size / 2 - 16;
  const circumference = 2 * Math.PI * radius;

  if (total === 0) {
    return (
      <div className="flex items-center justify-center text-sm text-slate-400" style={{ height: size, width: size }}>
        No data
      </div>
    );
  }

  let offset = 0;
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#f1f5f9"
            strokeWidth={16}
          />
          {segments.map((seg, i) => {
            const frac = Math.abs(seg.value) / total;
            const dash = frac * circumference;
            const circle = (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth={16}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                strokeLinecap="round"
                className="transition-all duration-500"
              />
            );
            offset += dash;
            return circle;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs text-slate-400">Total</span>
          <span className="text-lg font-bold text-slate-900">{formatCurrency(total, currency)}</span>
        </div>
      </div>
      <div className="space-y-2">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-sm" style={{ background: seg.color }} />
            <span className="text-sm text-slate-600">{seg.label}</span>
            <span className="text-sm font-semibold text-slate-900">
              {formatCurrency(seg.value, currency)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface LineChartProps {
  data: { label: string; value: number }[];
  height?: number;
  currency?: string;
  color?: string;
}

export function LineChart({ data, height = 200, color = '#0284c7' }: LineChartProps) {
  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center text-sm text-slate-400" style={{ height }}>
        Not enough data
      </div>
    );
  }
  const width = 600;
  const padding = { top: 20, right: 16, bottom: 30, left: 16 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const values = data.map((d) => d.value);
  const minVal = Math.min(...values, 0);
  const maxVal = Math.max(...values, 1);
  const range = maxVal - minVal || 1;

  const points = data.map((d, i) => {
    const x = padding.left + (i / (data.length - 1)) * chartW;
    const y = padding.top + chartH - ((d.value - minVal) / range) * chartH;
    return { x, y, ...d };
  });

  const pathD = points
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(' ');
  const areaD = `${pathD} L ${points[points.length - 1].x} ${padding.top + chartH} L ${points[0].x} ${padding.top + chartH} Z`;

  return (
    <div className="w-full overflow-x-auto" style={{ minHeight: height }}>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ minWidth: width, height }}>
        <defs>
          <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.2} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#lineGradient)" />
        <path d={pathD} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={3.5} fill="white" stroke={color} strokeWidth={2} />
            <text x={p.x} y={height - 8} textAnchor="middle" className="fill-slate-400 text-[10px]">
              {p.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

import { useId } from 'react';

export function LineChart({
  values,
  labels,
  height = 190,
  max,
  ticks,
  formatTick = (v: number) => String(v),
  color = '#2E7D32',
}: {
  values: number[];
  labels: string[];
  height?: number;
  max?: number;
  ticks?: number[];
  formatTick?: (v: number) => string;
  color?: string;
}) {
  const id = useId().replace(/:/g, '');
  const W = 620;
  const H = 240;
  const padL = 52;
  const padR = 12;
  const padT = 12;
  const padB = 30;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const peak = (max ?? Math.max(...values) * 1.08) || 1;
  const tickList = ticks ?? [0, peak * 0.25, peak * 0.5, peak * 0.75, peak].map((t) => Math.round(t));
  const x = (i: number) => padL + (i / Math.max(1, values.length - 1)) * plotW;
  const y = (v: number) => padT + plotH - (v / peak) * plotH;
  const line = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${line} L${x(values.length - 1)},${padT + plotH} L${x(0)},${padT + plotH} Z`;

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} style={{ height }} role="img" aria-label="Monthly trend chart">
      <defs>
        <linearGradient id={`area-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {tickList.map((t) => (
        <g key={t}>
          <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="#E6ECE7" strokeDasharray="4 6" />
          <text x={padL - 10} y={y(t) + 4} textAnchor="end" className="chart-tick">
            {formatTick(t)}
          </text>
        </g>
      ))}
      <path d={area} fill={`url(#area-${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      {values.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r="3.4" fill="#fff" stroke={color} strokeWidth="2" />
      ))}
      {labels.map((l, i) => (
        <text key={l} x={x(i)} y={H - 8} textAnchor="middle" className="chart-tick">
          {l}
        </text>
      ))}
    </svg>
  );
}

export function Donut({
  segments,
  size = 168,
  thickness = 22,
  centerLabel,
  centerValue,
}: {
  segments: { label: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="donut" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Waste breakdown">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EEF3EE" strokeWidth={thickness} />
        {segments.map((s) => {
          const len = (s.value / total) * c;
          const dash = Math.max(0, len - 3);
          const el = (
            <circle
              key={s.label}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={thickness}
              strokeDasharray={`${dash} ${c - dash}`}
              strokeDashoffset={-offset}
              strokeLinecap="round"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="donut-center">
        {centerValue && <strong>{centerValue}</strong>}
        {centerLabel && <span>{centerLabel}</span>}
      </div>
    </div>
  );
}

export function ComparisonChart({
  labels,
  a,
  b,
  colorA = '#2E7D32',
  colorB = '#42A5F5',
  height = 210,
}: {
  labels: string[];
  a: number[];
  b: number[];
  colorA?: string;
  colorB?: string;
  height?: number;
}) {
  const W = 640;
  const H = 260;
  const padL = 46;
  const padR = 12;
  const padT = 12;
  const padB = 30;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const peak = Math.max(...a, ...b) * 1.12;
  const x = (i: number) => padL + (i / Math.max(1, labels.length - 1)) * plotW;
  const y = (v: number) => padT + plotH - (v / peak) * plotH;
  const path = (arr: number[]) =>
    arr.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} style={{ height }} role="img" aria-label="Trees saved and CO2 reduced by month">
      {[0, 0.25, 0.5, 0.75, 1].map((p) => (
        <g key={p}>
          <line x1={padL} x2={W - padR} y1={y(peak * p)} y2={y(peak * p)} stroke="#E6ECE7" strokeDasharray="4 6" />
          <text x={padL - 10} y={y(peak * p) + 4} textAnchor="end" className="chart-tick">
            {Math.round(peak * p)}
          </text>
        </g>
      ))}
      <path d={path(a)} fill="none" stroke={colorA} strokeWidth="2.6" strokeLinecap="round" />
      <path d={path(b)} fill="none" stroke={colorB} strokeWidth="2.6" strokeLinecap="round" />
      {labels.map((l, i) => (
        <text key={l} x={x(i)} y={H - 8} textAnchor="middle" className="chart-tick">
          {l}
        </text>
      ))}
    </svg>
  );
}

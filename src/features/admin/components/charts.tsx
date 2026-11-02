import { formatCompactCurrency } from "@/lib/format";

/**
 * Lightweight SVG charts (no chart library) for the admin overview.
 * Each has an accessible text alternative via <title>/<desc> and an sr-only data table.
 */

/** Round a maximum up to a "nice" axis: 5 equal steps of 1, 2 or 5 × 10ⁿ. */
function niceAxis(peak: number, minimum = 5) {
  const raw = Math.max(peak, minimum) / 5;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalised = raw / magnitude;
  const step = (normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10) * magnitude;
  return { max: step * 5, ticks: [0, 1, 2, 3, 4, 5].map((index) => index * step) };
}

export function BarChart({ data }: { data: { name: string; value: number }[] }) {
  const width = 470;
  const height = 210;
  const left = 22;
  const bottom = 22;
  const plotH = height - bottom;
  const slot = (width - left) / data.length;
  const peak = Math.max(0, ...data.map((item) => item.value));
  const { max, ticks } = niceAxis(peak);

  return (
    <figure>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-labelledby="workload-title">
        <title id="workload-title">Open tasks per team member</title>
        {ticks.map((tick) => {
          const y = plotH - (tick / max) * (plotH - 8);
          return (
            <g key={tick}>
              <line x1={left} x2={width} y1={y} y2={y} stroke="#eceef0" />
              <text x={0} y={y + 3} className="fill-navy text-[8px]">
                {tick}
              </text>
            </g>
          );
        })}
        {data.map((item, index) => {
          const h = (item.value / max) * (plotH - 8);
          const x = left + index * slot + 4;
          const isPeak = peak > 0 && item.value === peak;
          return (
            <g key={item.name}>
              <rect
                x={x}
                y={plotH - h}
                width={slot - 8}
                height={h}
                fill={isPeak ? "var(--color-brand)" : index % 2 ? "#a9aecb" : "#c9cbde"}
                className="transition-opacity hover:opacity-80"
              >
                <title>{`${item.name}: ${item.value} tasks`}</title>
              </rect>
              <text x={x + (slot - 8) / 2} y={height - 4} textAnchor="middle" className="fill-navy text-[8px] font-medium">
                {item.name}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

export function DonutChart({
  segments,
  total,
}: {
  segments: { label: string; value: number; color: string }[];
  total: number;
}) {
  const radius = 54;
  if (total === 0) {
    return <p className="py-16 text-center text-sm text-muted">No projects yet.</p>;
  }
  const stroke = 30;
  const circumference = 2 * Math.PI * radius;
  // Start offset of each arc = sum of the arcs before it.
  const arcs = segments.map((segment, index) => {
    const length = (segment.value / 100) * circumference;
    const start = segments.slice(0, index).reduce((sum, item) => sum + (item.value / 100) * circumference, 0);
    return { ...segment, length, start };
  });

  return (
    <div>
      <div className="relative mx-auto size-[160px]">
        <svg viewBox="0 0 160 160" className="size-full -rotate-90" role="img" aria-label={`Projects by status, ${total} total`}>
          <defs>
            <pattern id="donut-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="4" height="4" fill="#e6e6e6" />
              <line x1="0" y1="0" x2="0" y2="4" stroke="#c4c4c4" strokeWidth="1.5" />
            </pattern>
          </defs>
          {arcs.map((arc, index) => (
            <circle
              key={arc.label}
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke={index === arcs.length - 1 ? "url(#donut-hatch)" : arc.color}
              strokeWidth={stroke}
              strokeDasharray={`${Math.max(arc.length - 3, 0)} ${circumference - arc.length + 3}`}
              strokeDashoffset={-arc.start}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-semibold text-navy">{total}</span>
          <span className="text-[10px] text-muted">Total</span>
        </div>
      </div>
      <ul className="mt-6 grid gap-2 text-sm">
        {segments.map((segment) => (
          <li key={segment.label} className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-navy">
              <span className="size-2.5 rounded-full" style={{ background: segment.color }} aria-hidden />
              {segment.label}
            </span>
            <span className="font-medium text-navy">{segment.value}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LineChart({
  points,
  months,
  highlightIndex,
}: {
  points: number[];
  months: string[];
  highlightIndex?: number;
}) {
  const { max, ticks } = niceAxis(Math.max(0, ...points), 1000);
  const width = 1100;
  const height = 260;
  const left = 44;
  const right = 10;
  const top = 16;
  const bottom = 28;
  const plotW = width - left - right;
  const plotH = height - top - bottom;
  const x = (index: number) => left + (index / (points.length - 1)) * plotW;
  const y = (value: number) => top + plotH - (value / max) * plotH;
  const path = points.map((value, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(" ");
  const highlight = highlightIndex !== undefined ? points[highlightIndex] : undefined;

  return (
    <figure>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-labelledby="revenue-title">
        <title id="revenue-title">{`Revenue trend, ${months[0]} to ${months.at(-1)}`}</title>
        <defs>
          <linearGradient id="revenue-highlight" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-brand)" stopOpacity="0" />
            <stop offset="100%" stopColor="var(--color-brand)" stopOpacity="1" />
          </linearGradient>
        </defs>
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} stroke="#eceef0" />
            <text x={0} y={y(tick) + 4} className="fill-navy text-[11px] font-medium">
              {tick === 0 ? "0" : formatCompactCurrency(tick)}
            </text>
          </g>
        ))}
        {/* Vertical hatching under the plot, as in the design. */}
        {Array.from({ length: 90 }).map((_, index) => {
          const px = left + (index / 89) * plotW;
          return <line key={index} x1={px} x2={px} y1={top + plotH} y2={top + plotH - 140} stroke="var(--color-brand)" strokeOpacity="0.18" />;
        })}
        {highlight !== undefined && highlightIndex !== undefined ? (
          <rect x={x(highlightIndex) - 30} y={y(highlight)} width={60} height={top + plotH - y(highlight)} fill="url(#revenue-highlight)" />
        ) : null}
        <path d={path} fill="none" stroke="var(--color-brand)" strokeWidth="2" />
        {points.map((value, index) => (
          <circle key={index} cx={x(index)} cy={y(value)} r="4" fill="white" stroke="var(--color-brand)" strokeWidth="1.5">
            <title>{formatCompactCurrency(value)}</title>
          </circle>
        ))}
        {highlight !== undefined && highlightIndex !== undefined ? (
          <g transform={`translate(${x(highlightIndex)}, ${y(highlight) - 48})`}>
            <rect x={-42} y={-18} width={84} height={36} rx={10} fill="var(--color-brand)" />
            <text textAnchor="middle" y={5} className="fill-white text-[14px] font-semibold">
              {formatCompactCurrency(highlight)}
            </text>
          </g>
        ) : null}
        {months.map((month, index) => (
          <text
            key={month}
            x={left + (index / (months.length - 1)) * plotW}
            y={height - 6}
            textAnchor="middle"
            className="fill-navy text-[11px] font-medium"
          >
            {month}
          </text>
        ))}
      </svg>
    </figure>
  );
}

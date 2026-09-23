const CHART_WIDTH = 560;
const CHART_HEIGHT = 160;
const PADDING_TOP = 8;
const PADDING_BOTTOM = 22; // room for month labels
const PADDING_X = 8;
const BAR_GAP = 10;

function niceMax(rawMax: number) {
  if (rawMax <= 0) return 4;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawMax)));
  const normalized = rawMax / magnitude;
  const niceNormalized = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return niceNormalized * magnitude;
}

function formatKyat(value: number) {
  return `MMK ${Math.round(value).toLocaleString()}`;
}

// Diverging bar chart around a zero baseline — profit can go negative, so
// (unlike WeeklyAppointmentsChart) bars grow up or down from a center line
// instead of always from the bottom, and color carries the sign. Same
// dependency-free inline-SVG approach as the rest of this project's charts.
export function ProfitTrendChart({
  data,
}: {
  data: { key: string; label: string; total: number }[];
}) {
  const rawMax = Math.max(...data.map((d) => Math.abs(d.total)), 0);
  const max = niceMax(rawMax);
  const plotHeight = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM;
  const zeroY = PADDING_TOP + plotHeight / 2;
  const halfHeight = plotHeight / 2;
  const plotWidth = CHART_WIDTH - PADDING_X * 2;
  const barWidth = (plotWidth - BAR_GAP * (data.length - 1)) / data.length;

  return (
    <svg
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      preserveAspectRatio="none"
      className="h-32 w-full"
      role="img"
      aria-label="Profit or loss for each of the last six months"
    >
      <line
        x1={PADDING_X}
        x2={CHART_WIDTH - PADDING_X}
        y1={zeroY}
        y2={zeroY}
        className="stroke-muted-foreground/25"
        strokeWidth={1}
      />
      {data.map((d, i) => {
        const x = PADDING_X + i * (barWidth + BAR_GAP);
        const barHeight = max === 0 ? 0 : (Math.abs(d.total) / max) * halfHeight;
        const y = d.total >= 0 ? zeroY - barHeight : zeroY;
        const positive = d.total >= 0;
        return (
          <g key={d.key}>
            <title>
              {d.label}: {formatKyat(d.total)}
            </title>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(1, barHeight)}
              rx={3}
              className={positive ? "fill-emerald-500" : "fill-rose-500"}
            />
            <text
              x={x + barWidth / 2}
              y={CHART_HEIGHT - 4}
              textAnchor="middle"
              className="fill-muted-foreground text-[11px] font-medium"
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

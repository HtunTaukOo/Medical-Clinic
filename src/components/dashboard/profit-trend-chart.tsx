const CHART_WIDTH = 560;
const CHART_HEIGHT = 160;
const PADDING_TOP = 8;
const PADDING_BOTTOM = 22; // room for month labels
const PADDING_X = 8;
const BAR_GAP = 10;

const BAR_STAGGER_MS = 70;
const BAR_DURATION_MS = 560;
const OVERSHOOT = 1.08; // bars grow slightly past their final height, then settle — a small spring feel instead of a flat linear grow

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
// dependency-free inline-SVG approach as the rest of this project's charts,
// with bars growing in from the zero line on load via native SVG <animate>
// (SMIL) — no client component or animation library needed.
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
      className="h-32 w-full overflow-visible"
      role="img"
      aria-label="Profit or loss for each of the last six months"
    >
      <defs>
        <linearGradient id="profit-bar-positive" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" className="[stop-color:var(--color-emerald-400)]" stopOpacity="1" />
          <stop offset="100%" className="[stop-color:var(--color-emerald-600)]" stopOpacity="1" />
        </linearGradient>
        <linearGradient id="profit-bar-negative" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" className="[stop-color:var(--color-rose-500)]" stopOpacity="1" />
          <stop offset="100%" className="[stop-color:var(--color-rose-600)]" stopOpacity="1" />
        </linearGradient>
      </defs>
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
        const finalHeight = Math.max(1, max === 0 ? 0 : (Math.abs(d.total) / max) * halfHeight);
        const positive = d.total >= 0;
        const finalY = positive ? zeroY - finalHeight : zeroY;
        const overshootHeight = finalHeight * OVERSHOOT;
        const overshootY = positive ? zeroY - overshootHeight : zeroY;
        const begin = i * BAR_STAGGER_MS;

        return (
          <g key={d.key}>
            <title>
              {d.label}: {formatKyat(d.total)}
            </title>
            <rect
              x={x}
              y={zeroY}
              width={barWidth}
              height={0}
              rx={3}
              fill={`url(#profit-bar-${positive ? "positive" : "negative"})`}
              className="cursor-pointer transition-opacity duration-150 hover:opacity-80"
            >
              <animate
                attributeName="height"
                values={`0;${overshootHeight.toFixed(2)};${finalHeight.toFixed(2)}`}
                keyTimes="0;0.7;1"
                keySplines="0.33 1 0.68 1;0.33 1 0.68 1"
                calcMode="spline"
                dur={`${BAR_DURATION_MS}ms`}
                begin={`${begin}ms`}
                fill="freeze"
              />
              <animate
                attributeName="y"
                values={`${zeroY};${overshootY.toFixed(2)};${finalY.toFixed(2)}`}
                keyTimes="0;0.7;1"
                keySplines="0.33 1 0.68 1;0.33 1 0.68 1"
                calcMode="spline"
                dur={`${BAR_DURATION_MS}ms`}
                begin={`${begin}ms`}
                fill="freeze"
              />
            </rect>
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

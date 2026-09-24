const CHART_WIDTH = 560;
const CHART_HEIGHT = 200;
const PADDING_TOP = 28;
const PADDING_BOTTOM = 22;
const PADDING_X = 10;

const DRAW_DURATION_MS = 1100;

// One color per month, sweeping across the palette left to right — the line's
// stroke gradient and each point's dot share this same sequence, so the
// "hue" reads as one continuous rainbow rather than an arbitrary line color.
const HUE_SEQUENCE = [
  { stop: "var(--color-indigo-500)", dot: "fill-indigo-500" },
  { stop: "var(--color-violet-500)", dot: "fill-violet-500" },
  { stop: "var(--color-fuchsia-500)", dot: "fill-fuchsia-500" },
  { stop: "var(--color-pink-500)", dot: "fill-pink-500" },
  { stop: "var(--color-rose-500)", dot: "fill-rose-500" },
  { stop: "var(--color-orange-400)", dot: "fill-orange-400" },
];

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

// Catmull-Rom -> cubic Bezier conversion (tension 6), the standard way to
// draw a smooth curve through a set of points without a charting library —
// same dependency-free inline-SVG approach as the rest of this project's
// charts, just with curved instead of straight segments.
function buildSmoothPath(points: { x: number; y: number }[]) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

export function RevenueTrendChart({
  data,
}: {
  data: { key: string; label: string; total: number }[];
}) {
  const rawMax = Math.max(...data.map((d) => d.total), 0);
  const max = niceMax(rawMax);
  const plotHeight = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM;
  const plotWidth = CHART_WIDTH - PADDING_X * 2;
  const baselineY = CHART_HEIGHT - PADDING_BOTTOM;
  const stepX = data.length > 1 ? plotWidth / (data.length - 1) : 0;

  const points = data.map((d, i) => ({
    x: PADDING_X + i * stepX,
    y: PADDING_TOP + plotHeight - (max === 0 ? 0 : (d.total / max) * plotHeight),
  }));

  const linePath = buildSmoothPath(points);
  const lastPoint = points[points.length - 1];
  const firstPoint = points[0];
  const areaPath =
    points.length > 0
      ? `${linePath} L ${lastPoint.x.toFixed(2)} ${baselineY} L ${firstPoint.x.toFixed(2)} ${baselineY} Z`
      : "";

  return (
    <svg
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      preserveAspectRatio="none"
      className="h-48 w-full overflow-visible"
      role="img"
      aria-label="Revenue for each of the last six months"
    >
      <defs>
        <linearGradient id="revenue-line-hue" x1="0" y1="0" x2="1" y2="0">
          {HUE_SEQUENCE.map((h, i) => (
            <stop
              key={i}
              offset={`${(i / (HUE_SEQUENCE.length - 1)) * 100}%`}
              style={{ stopColor: h.stop }}
            />
          ))}
        </linearGradient>
        <linearGradient id="revenue-area-hue" x1="0" y1="0" x2="1" y2="0">
          {HUE_SEQUENCE.map((h, i) => (
            <stop
              key={i}
              offset={`${(i / (HUE_SEQUENCE.length - 1)) * 100}%`}
              style={{ stopColor: h.stop }}
              stopOpacity="0.3"
            />
          ))}
        </linearGradient>
        <linearGradient id="revenue-area-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="1" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <mask id="revenue-area-mask">
          <rect x="0" y="0" width={CHART_WIDTH} height={CHART_HEIGHT} fill="url(#revenue-area-fade)" />
        </mask>
        <filter id="revenue-dot-glow" x="-150%" y="-150%" width="400%" height="400%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {[0, 0.5, 1].map((t) => {
        const y = PADDING_TOP + t * plotHeight;
        return (
          <line
            key={t}
            x1={PADDING_X}
            x2={CHART_WIDTH - PADDING_X}
            y1={y}
            y2={y}
            className="stroke-muted-foreground/15"
            strokeWidth={1}
          />
        );
      })}

      {areaPath && (
        <path d={areaPath} fill="url(#revenue-area-hue)" mask="url(#revenue-area-mask)" opacity={0}>
          <animate attributeName="opacity" values="0;1" dur="900ms" begin="300ms" fill="freeze" />
        </path>
      )}

      <path
        d={linePath}
        fill="none"
        stroke="url(#revenue-line-hue)"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray="1"
        strokeDashoffset="1"
      >
        <animate
          attributeName="stroke-dashoffset"
          values="1;0"
          dur={`${DRAW_DURATION_MS}ms`}
          calcMode="spline"
          keySplines="0.33 1 0.68 1"
          fill="freeze"
        />
      </path>

      {points.map((p, i) => {
        const hue = HUE_SEQUENCE[i % HUE_SEQUENCE.length];
        const begin = points.length > 1 ? DRAW_DURATION_MS * (i / (points.length - 1)) * 0.85 : 0;
        return (
          <g key={data[i].key}>
            <title>
              {data[i].label}: {formatKyat(data[i].total)}
            </title>
            <circle
              cx={p.x}
              cy={p.y}
              r={4.5}
              strokeWidth={2.5}
              className={`${hue.dot} stroke-background`}
              filter="url(#revenue-dot-glow)"
              opacity={0}
            >
              <animate attributeName="opacity" values="0;1" dur="220ms" begin={`${begin}ms`} fill="freeze" />
            </circle>
            <text
              x={p.x}
              y={CHART_HEIGHT - 4}
              textAnchor="middle"
              className="fill-muted-foreground text-[11px] font-medium"
            >
              {data[i].label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

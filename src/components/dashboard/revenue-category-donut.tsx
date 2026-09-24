const SIZE = 200;
const CENTER = SIZE / 2;
const RADIUS = 74;
const STROKE_WIDTH = 26;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const SEGMENT_GAP = 5; // px of blank space between adjacent segments

const CATEGORY_STYLES: Record<string, { from: string; to: string; dot: string }> = {
  Consultations: { from: "var(--color-sky-400)", to: "var(--color-blue-600)", dot: "bg-blue-500" },
  "Lab Tests": { from: "var(--color-violet-400)", to: "var(--color-purple-600)", dot: "bg-purple-500" },
  "Pharmacy Sales": { from: "var(--color-emerald-400)", to: "var(--color-teal-600)", dot: "bg-emerald-500" },
  Prescriptions: { from: "var(--color-amber-400)", to: "var(--color-orange-600)", dot: "bg-amber-500" },
  "Clinic Services": { from: "var(--color-pink-400)", to: "var(--color-rose-600)", dot: "bg-rose-500" },
  Other: { from: "var(--color-slate-400)", to: "var(--color-slate-600)", dot: "bg-slate-500" },
};

function styleFor(label: string) {
  return CATEGORY_STYLES[label] ?? CATEGORY_STYLES.Other;
}

function slug(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function formatKyat(value: number) {
  return `MMK ${Math.round(value).toLocaleString()}`;
}

function formatCompactKyat(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return Math.round(value).toLocaleString();
}

// Donut built from stacked <circle> strokes (the classic dasharray-offset
// technique) rather than a charting library — same dependency-free inline
// SVG approach used across this project's other dashboard charts. Each
// category gets its own two-stop gradient so the ring reads as a run of
// distinct hues rather than one flat color per slice.
export function RevenueCategoryDonut({
  data,
}: {
  data: { label: string; value: number }[];
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  let cumulative = 0;

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-center">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="h-52 w-52 shrink-0"
        role="img"
        aria-label="Revenue breakdown by category"
      >
        <defs>
          {data.map((d) => {
            const style = styleFor(d.label);
            return (
              <linearGradient key={d.label} id={`donut-${slug(d.label)}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" style={{ stopColor: style.from }} />
                <stop offset="100%" style={{ stopColor: style.to }} />
              </linearGradient>
            );
          })}
        </defs>

        <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" className="stroke-muted/40" strokeWidth={STROKE_WIDTH} />

        {total > 0 &&
          data.map((d, i) => {
            const fraction = d.value / total;
            const rawLength = fraction * CIRCUMFERENCE;
            const segmentLength = Math.max(0, rawLength - SEGMENT_GAP);
            const startAngle = -90 + (cumulative / CIRCUMFERENCE) * 360;
            cumulative += rawLength;
            const begin = i * 130;

            return (
              <circle
                key={d.label}
                cx={CENTER}
                cy={CENTER}
                r={RADIUS}
                fill="none"
                stroke={`url(#donut-${slug(d.label)})`}
                strokeWidth={STROKE_WIDTH}
                strokeLinecap="round"
                strokeDasharray={`0 ${CIRCUMFERENCE.toFixed(2)}`}
                transform={`rotate(${startAngle.toFixed(2)} ${CENTER} ${CENTER})`}
                className="cursor-pointer transition-opacity duration-150 hover:opacity-85"
              >
                <title>
                  {d.label}: {formatKyat(d.value)} ({Math.round(fraction * 1000) / 10}%)
                </title>
                <animate
                  attributeName="stroke-dasharray"
                  values={`0 ${CIRCUMFERENCE.toFixed(2)};${segmentLength.toFixed(2)} ${CIRCUMFERENCE.toFixed(2)}`}
                  dur="900ms"
                  begin={`${begin}ms`}
                  calcMode="spline"
                  keySplines="0.33 1 0.68 1"
                  fill="freeze"
                />
              </circle>
            );
          })}

        <text x={CENTER} y={CENTER - 6} textAnchor="middle" className="fill-muted-foreground text-[10px] font-medium uppercase tracking-wide">
          Total
        </text>
        <text x={CENTER} y={CENTER + 15} textAnchor="middle" className="fill-foreground text-[17px] font-bold">
          {total > 0 ? formatCompactKyat(total) : "—"}
        </text>
      </svg>

      <div className="grid w-full min-w-0 gap-3 sm:max-w-[13rem]">
        {data.length === 0 || total === 0 ? (
          <p className="text-sm text-muted-foreground">No revenue recorded yet.</p>
        ) : (
          data.map((d) => {
            const style = styleFor(d.label);
            const pct = Math.round((d.value / total) * 1000) / 10;
            return (
              <div key={d.label} className="grid min-w-0 gap-0.5 text-sm">
                <span className="flex items-center gap-2">
                  <span className={`size-2.5 shrink-0 rounded-full ${style.dot}`} />
                  <span className="truncate text-foreground">{d.label}</span>
                  <span className="ml-auto shrink-0 font-medium text-foreground">{pct}%</span>
                </span>
                <span className="pl-[18px] text-xs text-muted-foreground">{formatKyat(d.value)}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

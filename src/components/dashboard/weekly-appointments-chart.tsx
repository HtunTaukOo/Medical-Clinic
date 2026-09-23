const CHART_WIDTH = 560;
const CHART_HEIGHT = 200;
const PADDING_TOP = 24; // room for the value label above the tallest bar
const PADDING_BOTTOM = 22; // room for day-of-week labels
const PADDING_X = 8;
const BAR_GAP = 10;

const BAR_STAGGER_MS = 70;
const BAR_DURATION_MS = 560;
const OVERSHOOT = 1.06; // bars grow slightly past their final height, then settle — a small spring feel instead of a flat linear grow
const LABEL_DURATION_MS = 220;

// "Nice" round axis ceiling (1/2/5 × a power of ten) so gridlines land on
// sensible numbers instead of an arbitrary max — standard chart-axis trick.
function niceMax(rawMax: number) {
  if (rawMax <= 0) return 4;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawMax)));
  const normalized = rawMax / magnitude;
  const niceNormalized = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return niceNormalized * magnitude;
}

// Inline SVG bar chart — no charting library in this project (see
// src/components/patients/vitals-trend-chart.tsx), so this follows the same
// viewBox-based, dependency-free pattern rather than introducing one for a
// couple of dashboard widgets. Bars grow in on load via native SVG <animate>
// (SMIL) rather than CSS/JS — works in plain server-rendered HTML with no
// client component needed, staggered per bar with a slight overshoot so it
// reads as a small spring settle instead of a flat linear grow.
export function WeeklyAppointmentsChart({
  data,
}: {
  data: { label: string; value: number }[];
}) {
  const rawMax = Math.max(...data.map((d) => d.value), 0);
  const max = niceMax(rawMax);
  const plotHeight = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM;
  const plotWidth = CHART_WIDTH - PADDING_X * 2;
  const barWidth = (plotWidth - BAR_GAP * (data.length - 1)) / data.length;
  const baselineY = CHART_HEIGHT - PADDING_BOTTOM;

  const yFor = (value: number) => PADDING_TOP + plotHeight - (value / max) * plotHeight;

  return (
    <svg
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      preserveAspectRatio="none"
      className="h-48 w-full overflow-visible"
      role="img"
      aria-label="Appointments booked each day this week"
    >
      <defs>
        <linearGradient id="weekly-appts-bar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="1" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.6" />
        </linearGradient>
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
      {data.map((d, i) => {
        const x = PADDING_X + i * (barWidth + BAR_GAP);
        const finalY = yFor(d.value);
        const finalHeight = Math.max(0, baselineY - finalY);
        const overshootHeight = finalHeight * OVERSHOOT;
        const overshootY = baselineY - overshootHeight;
        const begin = i * BAR_STAGGER_MS;
        const labelBegin = begin + BAR_DURATION_MS * 0.75;

        return (
          <g key={d.label}>
            <title>
              {d.label}: {d.value} appointment{d.value === 1 ? "" : "s"}
            </title>
            <rect
              x={x}
              y={baselineY}
              width={barWidth}
              height={0}
              rx={4}
              fill="url(#weekly-appts-bar)"
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
                values={`${baselineY};${overshootY.toFixed(2)};${finalY.toFixed(2)}`}
                keyTimes="0;0.7;1"
                keySplines="0.33 1 0.68 1;0.33 1 0.68 1"
                calcMode="spline"
                dur={`${BAR_DURATION_MS}ms`}
                begin={`${begin}ms`}
                fill="freeze"
              />
            </rect>
            {d.value > 0 && (
              <text
                x={x + barWidth / 2}
                y={finalY - 6}
                textAnchor="middle"
                opacity={0}
                className="fill-primary text-[11px] font-medium"
              >
                {d.value}
                <animate
                  attributeName="opacity"
                  values="0;1"
                  dur={`${LABEL_DURATION_MS}ms`}
                  begin={`${labelBegin}ms`}
                  fill="freeze"
                />
              </text>
            )}
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

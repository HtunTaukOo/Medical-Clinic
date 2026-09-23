const CHART_WIDTH = 560;
const CHART_HEIGHT = 200;
const PADDING_TOP = 24; // room for the value label above the tallest bar
const PADDING_BOTTOM = 22; // room for day-of-week labels
const PADDING_X = 8;
const BAR_GAP = 10;

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
// couple of dashboard widgets. Replaces the old flex/div "bars" (which had
// no real gridlines and were nearly invisible on a light week) with an
// actual proportional chart.
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

  const yFor = (value: number) => PADDING_TOP + plotHeight - (value / max) * plotHeight;

  return (
    <svg
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      preserveAspectRatio="none"
      className="h-48 w-full"
      role="img"
      aria-label="Appointments booked each day this week"
    >
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
        const y = yFor(d.value);
        const barHeight = Math.max(0, CHART_HEIGHT - PADDING_BOTTOM - y);
        return (
          <g key={d.label}>
            <title>
              {d.label}: {d.value} appointment{d.value === 1 ? "" : "s"}
            </title>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              rx={4}
              className="fill-primary"
            />
            {d.value > 0 && (
              <text
                x={x + barWidth / 2}
                y={y - 6}
                textAnchor="middle"
                className="fill-primary text-[11px] font-medium"
              >
                {d.value}
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

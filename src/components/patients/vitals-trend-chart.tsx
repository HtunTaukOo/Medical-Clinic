import { cn } from "@/lib/utils";

export type VitalsTrendPoint = { date: Date; value: number };
export type VitalsTrendSeries = {
  label: string;
  unit: string;
  // A Tailwind text-color class — used as the line/dot color via currentColor.
  colorClassName: string;
  points: VitalsTrendPoint[];
};

const CHART_WIDTH = 400;
const CHART_HEIGHT = 120;
const PADDING_X = 8;
const PADDING_Y = 10;

// Small inline SVG line chart — no charting library in this project, and a
// handful of these (one per vital sign) don't warrant adding one. Supports
// multiple series sharing one chart (blood pressure needs systolic +
// diastolic together). viewBox-based, so it scales responsively via CSS
// rather than fixed pixel dimensions.
export function VitalsTrendChart({ title, series }: { title: string; series: VitalsTrendSeries[] }) {
  const allPoints = series.flatMap((s) => s.points);

  if (allPoints.length === 0) {
    return (
      <div className="grid gap-1.5">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</p>
        <div className="flex h-24 items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
          No data in this range
        </div>
      </div>
    );
  }

  const minDate = Math.min(...allPoints.map((p) => p.date.getTime()));
  const maxDate = Math.max(...allPoints.map((p) => p.date.getTime()));
  const dateRange = Math.max(1, maxDate - minDate);

  const values = allPoints.map((p) => p.value);
  let minValue = Math.min(...values);
  let maxValue = Math.max(...values);
  if (minValue === maxValue) {
    minValue -= 1;
    maxValue += 1;
  }
  const pad = (maxValue - minValue) * 0.15;
  minValue -= pad;
  maxValue += pad;
  const valueRange = maxValue - minValue;

  const xFor = (date: Date) =>
    PADDING_X + ((date.getTime() - minDate) / dateRange) * (CHART_WIDTH - PADDING_X * 2);
  const yFor = (value: number) =>
    CHART_HEIGHT - PADDING_Y - ((value - minValue) / valueRange) * (CHART_HEIGHT - PADDING_Y * 2);

  return (
    <div className="grid gap-1.5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</p>
        {series.length > 1 && (
          <div className="flex items-center gap-3">
            {series.map((s) => (
              <span key={s.label} className={cn("flex items-center gap-1 text-[11px]", s.colorClassName)}>
                <span className="size-2 rounded-full bg-current" />
                <span className="text-muted-foreground">{s.label}</span>
              </span>
            ))}
          </div>
        )}
      </div>
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        preserveAspectRatio="none"
        className="h-28 w-full rounded-lg bg-muted/40"
      >
        {[0, 0.5, 1].map((t) => (
          <line
            key={t}
            x1={PADDING_X}
            x2={CHART_WIDTH - PADDING_X}
            y1={PADDING_Y + t * (CHART_HEIGHT - PADDING_Y * 2)}
            y2={PADDING_Y + t * (CHART_HEIGHT - PADDING_Y * 2)}
            className="stroke-muted-foreground/15"
            strokeWidth={1}
          />
        ))}
        {series.map((s) => {
          if (s.points.length === 0) return null;
          const sorted = [...s.points].sort((a, b) => a.date.getTime() - b.date.getTime());
          const path = sorted
            .map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(p.date).toFixed(1)} ${yFor(p.value).toFixed(1)}`)
            .join(" ");
          return (
            <g key={s.label} className={s.colorClassName}>
              <path
                d={path}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {sorted.map((p, i) => (
                <circle key={i} cx={xFor(p.date)} cy={yFor(p.value)} r={2.5} fill="currentColor">
                  <title>
                    {p.date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}:{" "}
                    {p.value}
                    {s.unit}
                  </title>
                </circle>
              ))}
            </g>
          );
        })}
      </svg>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{new Date(minDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
        <span>{new Date(maxDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
      </div>
    </div>
  );
}

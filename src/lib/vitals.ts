// Shared by the doctor-portal patient page's vitals history filter + trend
// charts. Only appointment-level vitals (BP, pulse, temp, RR, SpO2) can be
// trended over time — weight/height/BMI live on Patient itself, not per
// visit, so there's no history to chart for those; they stay as
// current-value-only in the existing snapshot card.

export const VITALS_RANGE_OPTIONS = [
  { value: "1m", label: "Last 1 month" },
  { value: "3m", label: "Last 3 months" },
  { value: "6m", label: "Last 6 months" },
  { value: "1y", label: "Last 1 year" },
  { value: "2y", label: "Last 2 years" },
  { value: "3y", label: "Last 3 years" },
  { value: "all", label: "All time" },
] as const;

export type VitalsRangeKey = (typeof VITALS_RANGE_OPTIONS)[number]["value"];

export function isVitalsRangeKey(value: string | undefined): value is VitalsRangeKey {
  return !!value && VITALS_RANGE_OPTIONS.some((o) => o.value === value);
}

// null = no cutoff (all time).
export function vitalsRangeCutoff(range: VitalsRangeKey, from: Date = new Date()): Date | null {
  const d = new Date(from);
  switch (range) {
    case "1m":
      d.setMonth(d.getMonth() - 1);
      return d;
    case "3m":
      d.setMonth(d.getMonth() - 3);
      return d;
    case "6m":
      d.setMonth(d.getMonth() - 6);
      return d;
    case "1y":
      d.setFullYear(d.getFullYear() - 1);
      return d;
    case "2y":
      d.setFullYear(d.getFullYear() - 2);
      return d;
    case "3y":
      d.setFullYear(d.getFullYear() - 3);
      return d;
    case "all":
      return null;
  }
}

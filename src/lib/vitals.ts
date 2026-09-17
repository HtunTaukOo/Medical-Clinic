import type { VitalsTrendSeries } from "@/components/patients/vitals-trend-chart";

// Shared by the doctor-portal patient page's vitals history filter + trend
// charts, and by the consultation page's sidebar (so a doctor can see the
// trend without leaving the chart they're actively filling in).

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

export type VitalsAppointment = {
  scheduledAt: Date;
  status: string;
  bpSystolic: number | null;
  bpDiastolic: number | null;
  heartRateBpm: number | null;
  temperatureC: number | null;
  respiratoryRate: number | null;
  spo2Percent: number | null;
  weightKg: number | null;
  heightCm: number | null;
};

// Every completed visit with at least one vital recorded, within the given
// cutoff (null = all time), oldest first — so a doctor can see the trend at
// a glance instead of just the single most recent reading.
export function filterVitalsHistory<T extends VitalsAppointment>(
  appointments: T[],
  cutoff: Date | null
): T[] {
  return appointments
    .filter(
      (a) =>
        a.status === "COMPLETED" &&
        (!cutoff || a.scheduledAt >= cutoff) &&
        (a.bpSystolic != null ||
          a.bpDiastolic != null ||
          a.heartRateBpm != null ||
          a.temperatureC != null ||
          a.respiratoryRate != null ||
          a.spo2Percent != null ||
          a.weightKg != null ||
          a.heightCm != null)
    )
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
}

export function buildVitalsChartSeries(
  vitalsHistory: VitalsAppointment[]
): { title: string; series: VitalsTrendSeries[] }[] {
  return [
    {
      title: "Blood Pressure (mmHg)",
      series: [
        {
          label: "Systolic",
          unit: "",
          colorClassName: "text-rose-500",
          points: vitalsHistory
            .filter((a) => a.bpSystolic != null)
            .map((a) => ({ date: a.scheduledAt, value: a.bpSystolic! })),
        },
        {
          label: "Diastolic",
          unit: "",
          colorClassName: "text-blue-500",
          points: vitalsHistory
            .filter((a) => a.bpDiastolic != null)
            .map((a) => ({ date: a.scheduledAt, value: a.bpDiastolic! })),
        },
      ],
    },
    {
      title: "Pulse (bpm)",
      series: [
        {
          label: "Pulse",
          unit: " bpm",
          colorClassName: "text-purple-500",
          points: vitalsHistory
            .filter((a) => a.heartRateBpm != null)
            .map((a) => ({ date: a.scheduledAt, value: a.heartRateBpm! })),
        },
      ],
    },
    {
      title: "Temperature (°C)",
      series: [
        {
          label: "Temp",
          unit: "°C",
          colorClassName: "text-amber-500",
          points: vitalsHistory
            .filter((a) => a.temperatureC != null)
            .map((a) => ({ date: a.scheduledAt, value: a.temperatureC! })),
        },
      ],
    },
    {
      title: "Respiratory Rate (/min)",
      series: [
        {
          label: "RR",
          unit: "/min",
          colorClassName: "text-teal-500",
          points: vitalsHistory
            .filter((a) => a.respiratoryRate != null)
            .map((a) => ({ date: a.scheduledAt, value: a.respiratoryRate! })),
        },
      ],
    },
    {
      title: "SpO2 (%)",
      series: [
        {
          label: "SpO2",
          unit: "%",
          colorClassName: "text-sky-500",
          points: vitalsHistory
            .filter((a) => a.spo2Percent != null)
            .map((a) => ({ date: a.scheduledAt, value: a.spo2Percent! })),
        },
      ],
    },
    {
      title: "Weight (kg)",
      series: [
        {
          label: "Weight",
          unit: " kg",
          colorClassName: "text-emerald-500",
          points: vitalsHistory
            .filter((a) => a.weightKg != null)
            .map((a) => ({ date: a.scheduledAt, value: a.weightKg! })),
        },
      ],
    },
    {
      title: "Height (cm)",
      series: [
        {
          label: "Height",
          unit: " cm",
          colorClassName: "text-indigo-500",
          points: vitalsHistory
            .filter((a) => a.heightCm != null)
            .map((a) => ({ date: a.scheduledAt, value: a.heightCm! })),
        },
      ],
    },
  ];
}

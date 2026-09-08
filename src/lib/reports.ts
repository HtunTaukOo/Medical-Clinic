import { prisma } from "@/lib/prisma";
import { clinicDateKey } from "@/lib/clinic-hours";

export const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export const REPORT_TABS = [
  { value: "appointments", label: "Appointments" },
  { value: "patients", label: "Patients" },
  { value: "doctors", label: "Doctors" },
  { value: "revenue", label: "Revenue" },
  { value: "services", label: "Service Usage" },
  { value: "expenses", label: "Expenses" },
] as const;
export type ReportTab = (typeof REPORT_TABS)[number]["value"];

function formatKyat(value: number) {
  return `K ${Math.round(value).toLocaleString()}`;
}

// Percent change vs. the prior period. `null` (rendered as "—") means there's
// no meaningful baseline to compare against, rather than a misleading +/-Infinity%.
function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? null : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function parseYMD(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  return { y, m, d };
}

function shiftDateKey(key: string, days: number): string {
  const { y, m, d } = parseYMD(key);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

function enumerateDayKeys(fromKey: string, toKey: string): string[] {
  const keys: string[] = [];
  let cur = fromKey;
  let guard = 0;
  while (cur <= toKey && guard < 3660) {
    keys.push(cur);
    cur = shiftDateKey(cur, 1);
    guard++;
  }
  return keys;
}

export function formatDateLabel(key: string) {
  const { y, m, d } = parseYMD(key);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

// A calendar day, expressed both as clinic-local Y-M-D keys (for grouping/display)
// and as UTC instants (for Prisma range queries) — plus the immediately preceding
// period of equal length, used as the baseline for the summary "growth" figure.
export type ReportRange = {
  from: string;
  to: string;
  start: Date;
  endExclusive: Date;
  prevStart: Date;
  prevEndExclusive: Date;
};

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export function resolveReportRange(fromParam?: string, toParam?: string): ReportRange {
  const todayKey = clinicDateKey(new Date());
  const { y: ty, m: tm } = parseYMD(todayKey);
  const defaultFrom = `${ty}-${String(tm).padStart(2, "0")}-01`;

  let fromKey = fromParam && YMD_RE.test(fromParam) ? fromParam : defaultFrom;
  let toKey = toParam && YMD_RE.test(toParam) ? toParam : todayKey;
  if (fromKey > toKey) [fromKey, toKey] = [toKey, fromKey];

  const f = parseYMD(fromKey);
  const t = parseYMD(toKey);
  const start = new Date(Date.UTC(f.y, f.m - 1, f.d));
  const endExclusive = new Date(Date.UTC(t.y, t.m - 1, t.d) + 86400000);
  const lengthMs = Math.max(86400000, endExclusive.getTime() - start.getTime());

  return {
    from: fromKey,
    to: toKey,
    start,
    endExclusive,
    prevStart: new Date(start.getTime() - lengthMs),
    prevEndExclusive: start,
  };
}

type SummaryFields = {
  totalLabel: string;
  totalValue: string;
  growthPercent: number | null;
  topPerformerLabel: string;
  topPerformerValue: string;
};

export type AppointmentReportRow = {
  date: string;
  total: number;
  completed: number;
  cancelled: number;
  scheduled: number;
  growthPercent: number | null;
};

export type ReportsPageData =
  | (SummaryFields & { kind: "appointments"; rows: AppointmentReportRow[] })
  | (SummaryFields & {
      kind: "patients";
      rows: { date: string; newPatients: number; growthPercent: number | null }[];
    })
  | (SummaryFields & {
      kind: "doctors";
      rows: {
        doctorId: string;
        name: string;
        specialty: string | null;
        completed: number;
        noShows: number;
        noShowRate: number;
        revenue: number;
      }[];
    })
  | (SummaryFields & {
      kind: "revenue";
      rows: { date: string; revenue: number; growthPercent: number | null }[];
    })
  | (SummaryFields & {
      kind: "services";
      rows: { serviceId: string; name: string; units: number; revenue: number }[];
    })
  | (SummaryFields & {
      kind: "expenses";
      rows: { date: string; total: number; growthPercent: number | null }[];
    });

export async function getAppointmentsReport(range: ReportRange): Promise<ReportsPageData> {
  const extendedStart = new Date(range.start.getTime() - 86400000);
  const [rows, previousCount, doctors] = await Promise.all([
    prisma.appointment.findMany({
      where: { scheduledAt: { gte: extendedStart, lt: range.endExclusive } },
      select: { scheduledAt: true, status: true, doctorId: true },
    }),
    prisma.appointment.count({
      where: { scheduledAt: { gte: range.prevStart, lt: range.prevEndExclusive } },
    }),
    prisma.doctorProfile.findMany({ include: { user: true } }),
  ]);

  const doctorNameById = new Map(doctors.map((d) => [d.id, d.user.name]));
  const inRange = rows.filter((r) => r.scheduledAt >= range.start);
  const totalRecords = inRange.length;

  const completedByDoctor = new Map<string, number>();
  for (const r of inRange) {
    if (r.status === "COMPLETED") {
      completedByDoctor.set(r.doctorId, (completedByDoctor.get(r.doctorId) ?? 0) + 1);
    }
  }
  let topDoctorId: string | null = null;
  let topDoctorCount = 0;
  for (const [id, count] of completedByDoctor) {
    if (count > topDoctorCount) {
      topDoctorId = id;
      topDoctorCount = count;
    }
  }

  const buckets = new Map<string, { total: number; completed: number; cancelled: number }>();
  for (const r of rows) {
    const key = clinicDateKey(r.scheduledAt);
    const bucket = buckets.get(key) ?? { total: 0, completed: 0, cancelled: 0 };
    bucket.total += 1;
    if (r.status === "COMPLETED") bucket.completed += 1;
    if (r.status === "CANCELLED") bucket.cancelled += 1;
    buckets.set(key, bucket);
  }

  const tableRows: AppointmentReportRow[] = enumerateDayKeys(range.from, range.to)
    .map((key) => {
      const bucket = buckets.get(key) ?? { total: 0, completed: 0, cancelled: 0 };
      const prevBucket = buckets.get(shiftDateKey(key, -1)) ?? { total: 0, completed: 0, cancelled: 0 };
      return {
        date: key,
        total: bucket.total,
        completed: bucket.completed,
        cancelled: bucket.cancelled,
        scheduled: bucket.total - bucket.completed - bucket.cancelled,
        growthPercent: pctChange(bucket.total, prevBucket.total),
      };
    })
    .reverse();

  return {
    kind: "appointments",
    totalLabel: "Total Records",
    totalValue: `${totalRecords} appointment${totalRecords === 1 ? "" : "s"}`,
    growthPercent: pctChange(totalRecords, previousCount),
    topPerformerLabel: "Top Performer",
    topPerformerValue: topDoctorId ? (doctorNameById.get(topDoctorId) ?? "Unknown") : "—",
    rows: tableRows,
  };
}

export async function getPatientsReport(range: ReportRange): Promise<ReportsPageData> {
  const extendedStart = new Date(range.start.getTime() - 86400000);
  const [patients, previousCount, appts, doctors] = await Promise.all([
    prisma.patient.findMany({
      where: { createdAt: { gte: extendedStart, lt: range.endExclusive } },
      select: { createdAt: true },
    }),
    prisma.patient.count({
      where: { createdAt: { gte: range.prevStart, lt: range.prevEndExclusive } },
    }),
    prisma.appointment.findMany({
      where: { scheduledAt: { gte: range.start, lt: range.endExclusive } },
      select: { doctorId: true, patientId: true },
    }),
    prisma.doctorProfile.findMany({ include: { user: true } }),
  ]);

  const doctorNameById = new Map(doctors.map((d) => [d.id, d.user.name]));
  const patientsByDoctor = new Map<string, Set<string>>();
  for (const a of appts) {
    const set = patientsByDoctor.get(a.doctorId) ?? new Set<string>();
    set.add(a.patientId);
    patientsByDoctor.set(a.doctorId, set);
  }
  let topDoctorId: string | null = null;
  let topCount = 0;
  for (const [id, set] of patientsByDoctor) {
    if (set.size > topCount) {
      topDoctorId = id;
      topCount = set.size;
    }
  }

  const inRange = patients.filter((p) => p.createdAt >= range.start);
  const totalRecords = inRange.length;

  const countsByDay = new Map<string, number>();
  for (const p of patients) {
    const key = clinicDateKey(p.createdAt);
    countsByDay.set(key, (countsByDay.get(key) ?? 0) + 1);
  }

  const tableRows = enumerateDayKeys(range.from, range.to)
    .map((key) => {
      const count = countsByDay.get(key) ?? 0;
      const prevCount = countsByDay.get(shiftDateKey(key, -1)) ?? 0;
      return { date: key, newPatients: count, growthPercent: pctChange(count, prevCount) };
    })
    .reverse();

  return {
    kind: "patients",
    totalLabel: "New Patients",
    totalValue: `${totalRecords} patient${totalRecords === 1 ? "" : "s"}`,
    growthPercent: pctChange(totalRecords, previousCount),
    topPerformerLabel: "Top Performer",
    topPerformerValue: topDoctorId
      ? `${doctorNameById.get(topDoctorId) ?? "Unknown"} (${topCount})`
      : "—",
    rows: tableRows,
  };
}

export async function getDoctorsReport(range: ReportRange): Promise<ReportsPageData> {
  const [doctors, appts, prevAppts, payments] = await Promise.all([
    prisma.doctorProfile.findMany({ include: { user: true } }),
    prisma.appointment.findMany({
      where: { scheduledAt: { gte: range.start, lt: range.endExclusive } },
      select: { doctorId: true, status: true },
    }),
    prisma.appointment.findMany({
      where: { scheduledAt: { gte: range.prevStart, lt: range.prevEndExclusive } },
      select: { doctorId: true },
    }),
    prisma.payment.findMany({
      where: { paidAt: { gte: range.start, lt: range.endExclusive } },
      select: { amount: true, invoice: { select: { appointment: { select: { doctorId: true } } } } },
    }),
  ]);

  const activeDoctorIds = new Set(appts.map((a) => a.doctorId));
  const previousActiveCount = new Set(prevAppts.map((a) => a.doctorId)).size;

  const revenueByDoctor = new Map<string, number>();
  for (const p of payments) {
    const id = p.invoice?.appointment?.doctorId;
    if (!id) continue;
    revenueByDoctor.set(id, (revenueByDoctor.get(id) ?? 0) + Number(p.amount));
  }

  const completedByDoctor = new Map<string, number>();
  const noShowByDoctor = new Map<string, number>();
  for (const a of appts) {
    if (a.status === "COMPLETED") {
      completedByDoctor.set(a.doctorId, (completedByDoctor.get(a.doctorId) ?? 0) + 1);
    }
    if (a.status === "NO_SHOW") {
      noShowByDoctor.set(a.doctorId, (noShowByDoctor.get(a.doctorId) ?? 0) + 1);
    }
  }

  const tableRows = doctors
    .map((d) => {
      const completed = completedByDoctor.get(d.id) ?? 0;
      const noShows = noShowByDoctor.get(d.id) ?? 0;
      return {
        doctorId: d.id,
        name: d.user.name,
        specialty: d.specialty,
        completed,
        noShows,
        noShowRate: completed + noShows > 0 ? Math.round((noShows / (completed + noShows)) * 100) : 0,
        revenue: revenueByDoctor.get(d.id) ?? 0,
      };
    })
    .filter((d) => activeDoctorIds.has(d.doctorId) || d.revenue > 0)
    .sort((a, b) => b.completed - a.completed);

  const top = tableRows[0];

  return {
    kind: "doctors",
    totalLabel: "Active Doctors",
    totalValue: `${activeDoctorIds.size} doctor${activeDoctorIds.size === 1 ? "" : "s"}`,
    growthPercent: pctChange(activeDoctorIds.size, previousActiveCount),
    topPerformerLabel: "Top Performer",
    topPerformerValue: top && top.completed > 0 ? top.name : "—",
    rows: tableRows,
  };
}

export async function getRevenueReport(range: ReportRange): Promise<ReportsPageData> {
  const extendedStart = new Date(range.start.getTime() - 86400000);
  const [payments, prevSum, doctors] = await Promise.all([
    prisma.payment.findMany({
      where: { paidAt: { gte: extendedStart, lt: range.endExclusive } },
      select: { amount: true, paidAt: true, invoice: { select: { appointment: { select: { doctorId: true } } } } },
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { paidAt: { gte: range.prevStart, lt: range.prevEndExclusive } },
    }),
    prisma.doctorProfile.findMany({ include: { user: true } }),
  ]);

  const doctorNameById = new Map(doctors.map((d) => [d.id, d.user.name]));
  const inRange = payments.filter((p) => p.paidAt >= range.start);
  const totalRevenue = inRange.reduce((sum, p) => sum + Number(p.amount), 0);
  const previousRevenue = Number(prevSum._sum.amount ?? 0);

  const revenueByDoctor = new Map<string, number>();
  for (const p of inRange) {
    const id = p.invoice?.appointment?.doctorId;
    if (!id) continue;
    revenueByDoctor.set(id, (revenueByDoctor.get(id) ?? 0) + Number(p.amount));
  }
  let topDoctorId: string | null = null;
  let topRevenue = 0;
  for (const [id, amt] of revenueByDoctor) {
    if (amt > topRevenue) {
      topDoctorId = id;
      topRevenue = amt;
    }
  }

  const byDay = new Map<string, number>();
  for (const p of payments) {
    const key = clinicDateKey(p.paidAt);
    byDay.set(key, (byDay.get(key) ?? 0) + Number(p.amount));
  }

  const tableRows = enumerateDayKeys(range.from, range.to)
    .map((key) => {
      const amount = byDay.get(key) ?? 0;
      const prevAmount = byDay.get(shiftDateKey(key, -1)) ?? 0;
      return { date: key, revenue: amount, growthPercent: pctChange(amount, prevAmount) };
    })
    .reverse();

  return {
    kind: "revenue",
    totalLabel: "Total Revenue",
    totalValue: formatKyat(totalRevenue),
    growthPercent: pctChange(totalRevenue, previousRevenue),
    topPerformerLabel: "Top Performer",
    topPerformerValue: topDoctorId ? (doctorNameById.get(topDoctorId) ?? "Unknown") : "—",
    rows: tableRows,
  };
}

export async function getServiceUsageReport(range: ReportRange): Promise<ReportsPageData> {
  const [items, prevItems] = await Promise.all([
    prisma.invoiceItem.findMany({
      where: {
        clinicServiceId: { not: null },
        invoice: { createdAt: { gte: range.start, lt: range.endExclusive } },
      },
      select: { clinicServiceId: true, quantity: true, unitPrice: true },
    }),
    prisma.invoiceItem.findMany({
      where: {
        clinicServiceId: { not: null },
        invoice: { createdAt: { gte: range.prevStart, lt: range.prevEndExclusive } },
      },
      select: { quantity: true },
    }),
  ]);

  const totalUnits = items.reduce((sum, i) => sum + i.quantity, 0);
  const previousUnits = prevItems.reduce((sum, i) => sum + i.quantity, 0);

  const statsByService = new Map<string, { units: number; revenue: number }>();
  for (const i of items) {
    if (!i.clinicServiceId) continue;
    const cur = statsByService.get(i.clinicServiceId) ?? { units: 0, revenue: 0 };
    cur.units += i.quantity;
    cur.revenue += i.quantity * Number(i.unitPrice);
    statsByService.set(i.clinicServiceId, cur);
  }
  const serviceIds = [...statsByService.keys()];
  const clinicServices = serviceIds.length
    ? await prisma.clinicService.findMany({ where: { id: { in: serviceIds } } })
    : [];
  const serviceNameById = new Map(clinicServices.map((s) => [s.id, s.name]));

  const tableRows = [...statsByService.entries()]
    .map(([serviceId, { units, revenue }]) => ({
      serviceId,
      name: serviceNameById.get(serviceId) ?? "Unknown",
      units,
      revenue,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const top = tableRows[0];

  return {
    kind: "services",
    totalLabel: "Services Used",
    totalValue: `${totalUnits} service${totalUnits === 1 ? "" : "s"}`,
    growthPercent: pctChange(totalUnits, previousUnits),
    topPerformerLabel: "Top Service",
    topPerformerValue: top ? top.name : "—",
    rows: tableRows,
  };
}

const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  RENT: "Rent",
  UTILITIES: "Utilities",
  SALARIES: "Salaries",
  SUPPLIES: "Supplies",
  EQUIPMENT: "Equipment",
  MAINTENANCE: "Maintenance",
  MARKETING: "Marketing",
  INSURANCE: "Insurance",
  OTHER: "Other",
};

export async function getExpensesReport(range: ReportRange): Promise<ReportsPageData> {
  const extendedStart = new Date(range.start.getTime() - 86400000);
  const [expenses, prevSum] = await Promise.all([
    prisma.expense.findMany({
      where: { paidAt: { gte: extendedStart, lt: range.endExclusive } },
      select: { amount: true, paidAt: true, category: true },
    }),
    prisma.expense.aggregate({
      _sum: { amount: true },
      where: { paidAt: { gte: range.prevStart, lt: range.prevEndExclusive } },
    }),
  ]);

  const inRange = expenses.filter((e) => e.paidAt >= range.start);
  const totalExpenses = inRange.reduce((sum, e) => sum + Number(e.amount), 0);
  const previousExpenses = Number(prevSum._sum.amount ?? 0);

  const totalByCategory = new Map<string, number>();
  for (const e of inRange) {
    totalByCategory.set(e.category, (totalByCategory.get(e.category) ?? 0) + Number(e.amount));
  }
  let topCategory: string | null = null;
  let topCategoryTotal = 0;
  for (const [category, amt] of totalByCategory) {
    if (amt > topCategoryTotal) {
      topCategory = category;
      topCategoryTotal = amt;
    }
  }

  const byDay = new Map<string, number>();
  for (const e of expenses) {
    const key = clinicDateKey(e.paidAt);
    byDay.set(key, (byDay.get(key) ?? 0) + Number(e.amount));
  }

  const tableRows = enumerateDayKeys(range.from, range.to)
    .map((key) => {
      const amount = byDay.get(key) ?? 0;
      const prevAmount = byDay.get(shiftDateKey(key, -1)) ?? 0;
      return { date: key, total: amount, growthPercent: pctChange(amount, prevAmount) };
    })
    .reverse();

  return {
    kind: "expenses",
    totalLabel: "Total Expenses",
    totalValue: formatKyat(totalExpenses),
    growthPercent: pctChange(totalExpenses, previousExpenses),
    topPerformerLabel: "Top Category",
    topPerformerValue: topCategory ? EXPENSE_CATEGORY_LABELS[topCategory] : "—",
    rows: tableRows,
  };
}

export async function getReportsPageData(tab: ReportTab, range: ReportRange): Promise<ReportsPageData> {
  switch (tab) {
    case "appointments":
      return getAppointmentsReport(range);
    case "patients":
      return getPatientsReport(range);
    case "doctors":
      return getDoctorsReport(range);
    case "revenue":
      return getRevenueReport(range);
    case "services":
      return getServiceUsageReport(range);
    case "expenses":
      return getExpensesReport(range);
  }
}

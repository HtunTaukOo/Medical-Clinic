import { prisma } from "@/lib/prisma";
import { GENDER_LABELS } from "@/lib/patients";

export const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const AGE_BUCKETS = [
  { label: "0–17", min: 0, max: 17 },
  { label: "18–29", min: 18, max: 29 },
  { label: "30–44", min: 30, max: 44 },
  { label: "45–59", min: 45, max: 59 },
  { label: "60+", min: 60, max: Infinity },
] as const;

function ageBucketLabel(dob: Date | null, now: Date): string {
  if (!dob) return "Unknown";
  let age = now.getFullYear() - dob.getFullYear();
  const hasNotHadBirthdayThisYear =
    now.getMonth() < dob.getMonth() ||
    (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate());
  if (hasNotHadBirthdayThisYear) age -= 1;
  return AGE_BUCKETS.find((b) => age >= b.min && age <= b.max)?.label ?? "Unknown";
}

export async function getReportData() {
  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    allPayments,
    recentPayments,
    medicineTotals,
    statusTotals,
    patientCount,
    completedAppointments,
    noShowByDoctor,
    completedByDoctor,
    doctors,
    patientDemographics,
    paymentsWithDoctor,
  ] = await Promise.all([
    prisma.payment.aggregate({ _sum: { amount: true } }),
    prisma.payment.findMany({
      where: { paidAt: { gte: sixMonthsAgo } },
      select: { amount: true, paidAt: true },
    }),
    prisma.prescriptionItem.groupBy({
      by: ["medicineId"],
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    }),
    prisma.appointment.groupBy({
      by: ["status"],
      _count: { status: true },
    }),
    prisma.patient.count(),
    prisma.appointment.count({ where: { status: "COMPLETED" } }),
    prisma.appointment.groupBy({
      by: ["doctorId"],
      where: { status: "NO_SHOW" },
      _count: { status: true },
    }),
    prisma.appointment.groupBy({
      by: ["doctorId"],
      where: { status: "COMPLETED" },
      _count: { status: true },
    }),
    prisma.doctorProfile.findMany({ include: { user: true } }),
    prisma.patient.findMany({ select: { dob: true, createdAt: true, gender: true } }),
    prisma.payment.findMany({
      select: {
        amount: true,
        invoice: { select: { appointment: { select: { doctorId: true } } } },
      },
    }),
  ]);

  const totalRevenue = Number(allPayments._sum.amount ?? 0);
  const revenueThisMonth = recentPayments
    .filter((p) => p.paidAt >= monthStart)
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const revenueByMonth: { key: string; label: string; total: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    revenueByMonth.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: MONTH_NAMES[d.getMonth()],
      total: 0,
    });
  }
  const monthIndex = new Map(revenueByMonth.map((m, i) => [m.key, i]));
  for (const payment of recentPayments) {
    const key = `${payment.paidAt.getFullYear()}-${payment.paidAt.getMonth()}`;
    const idx = monthIndex.get(key);
    if (idx !== undefined) {
      revenueByMonth[idx].total += Number(payment.amount);
    }
  }

  const medicineIds = medicineTotals.map((m) => m.medicineId);
  const medicines = await prisma.medicine.findMany({ where: { id: { in: medicineIds } } });
  const medicineNameById = new Map(medicines.map((m) => [m.id, m.name]));

  const totalAppointments = statusTotals.reduce((sum, s) => sum + s._count.status, 0);
  const noShowCount = statusTotals.find((s) => s.status === "NO_SHOW")?._count.status ?? 0;
  const noShowRate =
    completedAppointments + noShowCount > 0
      ? Math.round((noShowCount / (completedAppointments + noShowCount)) * 100)
      : 0;

  const doctorNameById = new Map(doctors.map((d) => [d.id, d.user.name]));
  const noShowsByDoctor = noShowByDoctor
    .map((d) => ({
      doctorId: d.doctorId,
      name: doctorNameById.get(d.doctorId) ?? "Unknown",
      count: d._count.status,
    }))
    .sort((a, b) => b.count - a.count);

  // Doctor productivity: completed visits, no-shows, and revenue attributed to
  // each doctor's appointments, merged across every doctor (not just the ones
  // that show up in a given metric's groupBy).
  const completedCountByDoctorId = new Map(
    completedByDoctor.map((d) => [d.doctorId, d._count.status])
  );
  const noShowCountByDoctorId = new Map(noShowByDoctor.map((d) => [d.doctorId, d._count.status]));
  const revenueByDoctorId = new Map<string, number>();
  for (const payment of paymentsWithDoctor) {
    const doctorId = payment.invoice?.appointment?.doctorId;
    if (!doctorId) continue;
    revenueByDoctorId.set(
      doctorId,
      (revenueByDoctorId.get(doctorId) ?? 0) + Number(payment.amount)
    );
  }
  const doctorProductivity = doctors
    .map((d) => {
      const completed = completedCountByDoctorId.get(d.id) ?? 0;
      const noShows = noShowCountByDoctorId.get(d.id) ?? 0;
      return {
        doctorId: d.id,
        name: d.user.name,
        specialty: d.specialty,
        completed,
        noShows,
        noShowRate:
          completed + noShows > 0 ? Math.round((noShows / (completed + noShows)) * 100) : 0,
        revenue: revenueByDoctorId.get(d.id) ?? 0,
      };
    })
    .sort((a, b) => b.completed - a.completed);

  // Patient demographics: age distribution + new-patient registration trend.
  const ageDistribution: { label: string; count: number }[] = AGE_BUCKETS.map((b) => ({
    label: b.label,
    count: 0,
  }));
  ageDistribution.push({ label: "Unknown", count: 0 });
  const ageIndexByLabel = new Map(ageDistribution.map((b, i) => [b.label, i]));
  for (const patient of patientDemographics) {
    const label = ageBucketLabel(patient.dob, now);
    const idx = ageIndexByLabel.get(label);
    if (idx !== undefined) ageDistribution[idx].count += 1;
  }

  const genderOrder = ["MALE", "FEMALE", "OTHER", "Unknown"];
  const genderCounts = new Map(genderOrder.map((g) => [g, 0]));
  for (const patient of patientDemographics) {
    const key = patient.gender ?? "Unknown";
    genderCounts.set(key, (genderCounts.get(key) ?? 0) + 1);
  }
  const genderDistribution = genderOrder.map((g) => ({
    label: g === "Unknown" ? "Unknown" : GENDER_LABELS[g],
    count: genderCounts.get(g) ?? 0,
  }));

  const newPatientsByMonth: { key: string; label: string; count: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    newPatientsByMonth.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: MONTH_NAMES[d.getMonth()],
      count: 0,
    });
  }
  const newPatientMonthIndex = new Map(newPatientsByMonth.map((m, i) => [m.key, i]));
  for (const patient of patientDemographics) {
    if (patient.createdAt < sixMonthsAgo) continue;
    const key = `${patient.createdAt.getFullYear()}-${patient.createdAt.getMonth()}`;
    const idx = newPatientMonthIndex.get(key);
    if (idx !== undefined) newPatientsByMonth[idx].count += 1;
  }

  return {
    totalRevenue,
    revenueThisMonth,
    patientCount,
    completedAppointments,
    revenueByMonth,
    medicineTotals,
    medicineNameById,
    statusTotals,
    totalAppointments,
    noShowCount,
    noShowRate,
    noShowsByDoctor,
    doctorProductivity,
    ageDistribution,
    genderDistribution,
    newPatientsByMonth,
  };
}

export type ReportData = Awaited<ReturnType<typeof getReportData>>;

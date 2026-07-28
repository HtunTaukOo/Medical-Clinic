import { prisma } from "@/lib/prisma";

export const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

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

  const doctorIds = noShowByDoctor.map((d) => d.doctorId);
  const doctors = await prisma.doctorProfile.findMany({
    where: { id: { in: doctorIds } },
    include: { user: true },
  });
  const doctorNameById = new Map(doctors.map((d) => [d.id, d.user.name]));
  const noShowsByDoctor = noShowByDoctor
    .map((d) => ({
      doctorId: d.doctorId,
      name: doctorNameById.get(d.doctorId) ?? "Unknown",
      count: d._count.status,
    }))
    .sort((a, b) => b.count - a.count);

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
  };
}

export type ReportData = Awaited<ReturnType<typeof getReportData>>;

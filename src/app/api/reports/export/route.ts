import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getReportData } from "@/lib/reports";

function csvEscape(value: string | number) {
  const str = String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function row(values: (string | number)[]) {
  return values.map(csvEscape).join(",") + "\n";
}

export async function GET() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const data = await getReportData();
  let csv = "";

  csv += "Summary\n";
  csv += row(["Total revenue", data.totalRevenue.toFixed(2)]);
  csv += row(["Revenue this month", data.revenueThisMonth.toFixed(2)]);
  csv += row(["Total patients", data.patientCount]);
  csv += row(["Completed visits", data.completedAppointments]);
  csv += row(["No-show rate", `${data.noShowRate}%`]);
  csv += "\n";

  csv += "Revenue by month\n";
  csv += row(["Month", "Total"]);
  for (const m of data.revenueByMonth) csv += row([m.label, m.total.toFixed(2)]);
  csv += "\n";

  csv += "Appointments by status\n";
  csv += row(["Status", "Count", "Percent"]);
  for (const s of data.statusTotals) {
    const pct =
      data.totalAppointments > 0
        ? Math.round((s._count.status / data.totalAppointments) * 100)
        : 0;
    csv += row([s.status, s._count.status, `${pct}%`]);
  }
  csv += "\n";

  csv += "Top prescribed medicines\n";
  csv += row(["Medicine", "Units"]);
  for (const m of data.medicineTotals) {
    csv += row([data.medicineNameById.get(m.medicineId) ?? "Unknown", m._sum.quantity ?? 0]);
  }
  csv += "\n";

  csv += "No-shows by doctor\n";
  csv += row(["Doctor", "No-shows"]);
  for (const d of data.noShowsByDoctor) csv += row([d.name, d.count]);
  csv += "\n";

  csv += "Doctor productivity\n";
  csv += row(["Doctor", "Specialty", "Completed visits", "No-shows", "No-show rate", "Revenue"]);
  for (const d of data.doctorProductivity) {
    csv += row([
      d.name,
      d.specialty ?? "",
      d.completed,
      d.noShows,
      `${d.noShowRate}%`,
      d.revenue.toFixed(2),
    ]);
  }
  csv += "\n";

  csv += "Patient age distribution\n";
  csv += row(["Age group", "Patients"]);
  for (const b of data.ageDistribution) csv += row([b.label, b.count]);
  csv += "\n";

  csv += "Patients by gender\n";
  csv += row(["Gender", "Patients"]);
  for (const g of data.genderDistribution) csv += row([g.label, g.count]);
  csv += "\n";

  csv += "New patients by month\n";
  csv += row(["Month", "New patients"]);
  for (const m of data.newPatientsByMonth) csv += row([m.label, m.count]);

  const filename = `nca-clinic-report-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

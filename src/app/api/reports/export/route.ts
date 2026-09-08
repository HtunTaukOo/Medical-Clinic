import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  REPORT_TABS,
  resolveReportRange,
  getReportsPageData,
  formatDateLabel,
  type ReportTab,
} from "@/lib/reports";

function formatKyat(value: number) {
  return `K ${Math.round(value).toLocaleString()}`;
}

function csvEscape(value: string | number) {
  const str = String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function row(values: (string | number)[]) {
  return values.map(csvEscape).join(",") + "\n";
}

function growthCell(value: number | null) {
  return value === null ? "—" : `${value}%`;
}

export async function GET(request: Request) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const url = new URL(request.url);
  const tabParam = url.searchParams.get("tab");
  const tab: ReportTab = REPORT_TABS.some((t) => t.value === tabParam)
    ? (tabParam as ReportTab)
    : "appointments";
  const range = resolveReportRange(
    url.searchParams.get("from") ?? undefined,
    url.searchParams.get("to") ?? undefined
  );
  const data = await getReportsPageData(tab, range);

  const label = REPORT_TABS.find((t) => t.value === tab)!.label;
  let csv = `${label} report (${range.from} to ${range.to})\n\n`;
  csv += row([data.totalLabel, data.totalValue]);
  csv += row(["Growth", growthCell(data.growthPercent)]);
  csv += row([data.topPerformerLabel, data.topPerformerValue]);
  csv += "\n";

  switch (data.kind) {
    case "appointments":
      csv += row(["Date", "Total", "Completed", "Cancelled", "Scheduled", "Growth"]);
      for (const r of data.rows) {
        csv += row([
          formatDateLabel(r.date),
          r.total,
          r.completed,
          r.cancelled,
          r.scheduled,
          growthCell(r.growthPercent),
        ]);
      }
      break;
    case "patients":
      csv += row(["Date", "New Patients", "Growth"]);
      for (const r of data.rows) {
        csv += row([formatDateLabel(r.date), r.newPatients, growthCell(r.growthPercent)]);
      }
      break;
    case "doctors":
      csv += row(["Doctor", "Specialty", "Completed", "No-shows", "No-show Rate", "Revenue"]);
      for (const d of data.rows) {
        csv += row([
          d.name,
          d.specialty ?? "",
          d.completed,
          d.noShows,
          `${d.noShowRate}%`,
          formatKyat(d.revenue),
        ]);
      }
      break;
    case "revenue":
      csv += row(["Date", "Revenue", "Growth"]);
      for (const r of data.rows) {
        csv += row([formatDateLabel(r.date), formatKyat(r.revenue), growthCell(r.growthPercent)]);
      }
      break;
    case "services":
      csv += row(["Service", "Times Billed", "Revenue"]);
      for (const r of data.rows) {
        csv += row([r.name, r.units, formatKyat(r.revenue)]);
      }
      break;
    case "expenses":
      csv += row(["Date", "Total", "Growth"]);
      for (const r of data.rows) {
        csv += row([formatDateLabel(r.date), formatKyat(r.total), growthCell(r.growthPercent)]);
      }
      break;
  }

  const filename = `nca-clinic-${tab}-report-${range.from}-to-${range.to}.csv`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

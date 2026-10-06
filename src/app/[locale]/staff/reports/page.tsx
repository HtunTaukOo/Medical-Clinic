import { Download, FileBarChart2 } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireStaffPermissionPage } from "@/lib/authz";
import { clinicDateKey } from "@/lib/clinic-hours";
import {
  REPORT_TABS,
  resolveReportRange,
  getReportsPageData,
  formatDateLabel,
  type ReportTab,
} from "@/lib/reports";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DateRangeFilter } from "@/components/reports/date-range-filter";
import { EmptyState } from "@/components/empty-state";
import { TabTransitionScope, TabButton, TabTransitionContent } from "@/components/tab-transition";

function formatKyat(value: number) {
  return `MMK ${Math.round(value).toLocaleString()}`;
}

function GrowthText({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={value >= 0 ? "text-emerald-600" : "text-rose-600"}>
      {value >= 0 ? "+" : ""}
      {value}%
    </span>
  );
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; from?: string; to?: string }>;
}) {
  await requireStaffPermissionPage("VIEW_REPORTS");
  const t = await getTranslations("reports");

  const { tab: tabParam, from, to } = await searchParams;
  const tab: ReportTab = REPORT_TABS.some((t) => t.value === tabParam)
    ? (tabParam as ReportTab)
    : "appointments";
  const range = resolveReportRange(from, to);
  const data = await getReportsPageData(tab, range);

  const exportHref = `/api/reports/export?tab=${tab}&from=${range.from}&to=${range.to}`;

  return (
    <TabTransitionScope>
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {REPORT_TABS.map(({ value }) => (
          <TabButton
            key={value}
            href={`/staff/reports?tab=${value}&from=${range.from}&to=${range.to}`}
            active={tab === value}
            size="sm"
            className="rounded-full"
          >
            {t(value === "services" ? "serviceUsage" : value)}
          </TabButton>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <DateRangeFilter
          defaultFrom={range.from}
          defaultTo={range.to}
          todayKey={clinicDateKey(new Date())}
        />
        <Button asChild size="sm">
          <a href={exportHref}>
            <Download />
            {t("exportCsv")}
          </a>
        </Button>
      </div>

      <TabTransitionContent className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent>
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {data.totalLabel}
            </p>
            <p className="mt-1 text-2xl font-semibold">{data.totalValue}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {t("growth")}
            </p>
            <p className="mt-1 text-2xl font-semibold">
              <GrowthText value={data.growthPercent} />
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {data.topPerformerLabel}
            </p>
            <p className="mt-1 truncate text-2xl font-semibold text-primary">
              {data.topPerformerValue}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent>
          {data.kind === "appointments" &&
            (data.rows.every((r) => r.total === 0) ? (
              <EmptyState icon={FileBarChart2} message={t("noAppointments")} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("date")}</TableHead>
                    <TableHead>{t("total")}</TableHead>
                    <TableHead>{t("completed")}</TableHead>
                    <TableHead>{t("cancelled")}</TableHead>
                    <TableHead>{t("scheduled")}</TableHead>
                    <TableHead>{t("growth")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((r) => (
                    <TableRow key={r.date}>
                      <TableCell className="font-medium">{formatDateLabel(r.date)}</TableCell>
                      <TableCell>{r.total}</TableCell>
                      <TableCell>{r.completed}</TableCell>
                      <TableCell>{r.cancelled}</TableCell>
                      <TableCell>{r.scheduled}</TableCell>
                      <TableCell>
                        <GrowthText value={r.growthPercent} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ))}

          {data.kind === "patients" &&
            (data.rows.every((r) => r.newPatients === 0) ? (
              <EmptyState icon={FileBarChart2} message={t("noPatients")} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("date")}</TableHead>
                    <TableHead>{t("newPatients")}</TableHead>
                    <TableHead>{t("growth")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((r) => (
                    <TableRow key={r.date}>
                      <TableCell className="font-medium">{formatDateLabel(r.date)}</TableCell>
                      <TableCell>{r.newPatients}</TableCell>
                      <TableCell>
                        <GrowthText value={r.growthPercent} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ))}

          {data.kind === "doctors" &&
            (data.rows.length === 0 ? (
              <EmptyState icon={FileBarChart2} message={t("noDoctorActivity")} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("doctor")}</TableHead>
                    <TableHead>{t("completed")}</TableHead>
                    <TableHead>{t("noShows")}</TableHead>
                    <TableHead>{t("noShowRate")}</TableHead>
                    <TableHead>{t("revenue")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((d) => (
                    <TableRow key={d.doctorId}>
                      <TableCell>
                        <p className="font-medium">{d.name}</p>
                        {d.specialty && (
                          <p className="text-sm text-muted-foreground">{d.specialty}</p>
                        )}
                      </TableCell>
                      <TableCell>{d.completed}</TableCell>
                      <TableCell>{d.noShows}</TableCell>
                      <TableCell>{d.noShowRate}%</TableCell>
                      <TableCell>{formatKyat(d.revenue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ))}

          {data.kind === "revenue" &&
            (data.rows.every((r) => r.revenue === 0) ? (
              <EmptyState icon={FileBarChart2} message={t("noRevenue")} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("date")}</TableHead>
                    <TableHead>{t("revenue")}</TableHead>
                    <TableHead>{t("growth")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((r) => (
                    <TableRow key={r.date}>
                      <TableCell className="font-medium">{formatDateLabel(r.date)}</TableCell>
                      <TableCell>{formatKyat(r.revenue)}</TableCell>
                      <TableCell>
                        <GrowthText value={r.growthPercent} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ))}

          {data.kind === "services" &&
            (data.rows.length === 0 ? (
              <EmptyState
                icon={FileBarChart2}
                message={t("noServices")}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("service")}</TableHead>
                    <TableHead>{t("timesBilled")}</TableHead>
                    <TableHead>{t("revenue")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((r) => (
                    <TableRow key={r.serviceId}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell>{r.units}</TableCell>
                      <TableCell>{formatKyat(r.revenue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ))}

          {data.kind === "expenses" &&
            (data.rows.every((r) => r.total === 0) ? (
              <EmptyState icon={FileBarChart2} message={t("noExpenses")} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("date")}</TableHead>
                    <TableHead>{t("total")}</TableHead>
                    <TableHead>{t("growth")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((r) => (
                    <TableRow key={r.date}>
                      <TableCell className="font-medium">{formatDateLabel(r.date)}</TableCell>
                      <TableCell>{formatKyat(r.total)}</TableCell>
                      <TableCell>
                        <GrowthText value={r.growthPercent} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ))}
        </CardContent>
      </Card>
      </TabTransitionContent>
    </div>
    </TabTransitionScope>
  );
}

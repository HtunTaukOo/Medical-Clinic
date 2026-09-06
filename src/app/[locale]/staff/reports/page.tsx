import { Download, FileBarChart2 } from "lucide-react";
import { requirePageRole } from "@/lib/authz";
import {
  REPORT_TABS,
  resolveReportRange,
  getReportsPageData,
  formatDateLabel,
  type ReportTab,
} from "@/lib/reports";
import { Link } from "@/i18n/navigation";
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

function formatKyat(value: number) {
  return `K ${Math.round(value).toLocaleString()}`;
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
  await requirePageRole(["ADMIN"]);

  const { tab: tabParam, from, to } = await searchParams;
  const tab: ReportTab = REPORT_TABS.some((t) => t.value === tabParam)
    ? (tabParam as ReportTab)
    : "appointments";
  const range = resolveReportRange(from, to);
  const data = await getReportsPageData(tab, range);

  const exportHref = `/api/reports/export?tab=${tab}&from=${range.from}&to=${range.to}`;

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Reports</h1>
          <p className="text-sm text-muted-foreground">Generate and view clinic analytics.</p>
        </div>
        <Button asChild>
          <a href={exportHref}>
            <Download />
            Export
          </a>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {REPORT_TABS.map(({ value, label }) => (
          <Button
            key={value}
            asChild
            variant={tab === value ? "default" : "outline"}
            size="sm"
            className="rounded-full"
          >
            <Link href={`/staff/reports?tab=${value}&from=${range.from}&to=${range.to}`}>
              {label}
            </Link>
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <DateRangeFilter defaultFrom={range.from} defaultTo={range.to} />
        <Button asChild variant="outline" size="sm">
          <a href={exportHref}>
            <Download />
            Export CSV
          </a>
        </Button>
      </div>

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
              Growth
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
              <EmptyState icon={FileBarChart2} message="No appointments in this date range." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead>Cancelled</TableHead>
                    <TableHead>Scheduled</TableHead>
                    <TableHead>Growth</TableHead>
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
              <EmptyState icon={FileBarChart2} message="No new patients in this date range." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>New Patients</TableHead>
                    <TableHead>Growth</TableHead>
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
              <EmptyState icon={FileBarChart2} message="No doctor activity in this date range." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Doctor</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead>No-shows</TableHead>
                    <TableHead>No-show Rate</TableHead>
                    <TableHead>Revenue</TableHead>
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
              <EmptyState icon={FileBarChart2} message="No revenue in this date range." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Revenue</TableHead>
                    <TableHead>Growth</TableHead>
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
                message="No clinic services billed in this date range."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service</TableHead>
                    <TableHead>Times Billed</TableHead>
                    <TableHead>Revenue</TableHead>
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
        </CardContent>
      </Card>
    </div>
  );
}

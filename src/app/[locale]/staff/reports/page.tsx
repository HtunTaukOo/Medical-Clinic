import { Wallet, CalendarCheck2, Users, Pill, UserX, Download, Stethoscope, UserPlus } from "lucide-react";
import { requirePageRole } from "@/lib/authz";
import { getReportData } from "@/lib/reports";
import { StatTile } from "@/components/stat-tile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BarList } from "@/components/reports/bar-list";

const STATUS_BAR_COLORS: Record<string, string> = {
  REQUESTED: "bg-amber-400",
  CONFIRMED: "bg-blue-400",
  CHECKED_IN: "bg-emerald-400",
  COMPLETED: "bg-slate-400",
  CANCELLED: "bg-rose-400",
  NO_SHOW: "bg-orange-400",
};

export default async function ReportsPage() {
  await requirePageRole(["ADMIN"]);

  const data = await getReportData();

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Reports</h1>
        <Button asChild variant="outline">
          <a href="/api/reports/export">
            <Download />
            Export CSV
          </a>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile icon={Wallet} value={data.totalRevenue.toFixed(2)} label="Total revenue" color="emerald" />
        <StatTile
          icon={Wallet}
          value={data.revenueThisMonth.toFixed(2)}
          label="Revenue this month"
          color="blue"
        />
        <StatTile icon={Users} value={data.patientCount} label="Total patients" color="purple" />
        <StatTile
          icon={CalendarCheck2}
          value={data.completedAppointments}
          label="Completed visits"
          color="amber"
        />
        <StatTile
          icon={UserX}
          value={`${data.noShowRate}%`}
          label="No-show rate"
          color="orange"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Revenue by month</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-48 items-end gap-4">
            {(() => {
              const max = Math.max(1, ...data.revenueByMonth.map((m) => m.total));
              return data.revenueByMonth.map((m) => (
                <div key={m.key} className="flex flex-1 flex-col items-center gap-2">
                  <span className="text-xs text-muted-foreground">{m.total.toFixed(0)}</span>
                  <div className="flex w-full flex-1 items-end">
                    <div
                      className="w-full rounded-t-md bg-primary"
                      style={{ height: `${Math.max(2, (m.total / max) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium">{m.label}</span>
                </div>
              ));
            })()}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Stethoscope className="size-4" />
            Doctor productivity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.doctorProductivity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No doctors on staff yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Completed visits</TableHead>
                  <TableHead>No-shows</TableHead>
                  <TableHead>No-show rate</TableHead>
                  <TableHead>Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.doctorProductivity.map((d) => (
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
                    <TableCell>{d.revenue.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-4" />
              Patient age distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.patientCount === 0 ? (
              <p className="text-sm text-muted-foreground">No patients yet.</p>
            ) : (
              <BarList
                items={data.ageDistribution
                  .filter((b) => b.count > 0)
                  .map((b) => ({
                    label: b.label,
                    value: b.count,
                    displayValue: `${b.count} (${Math.round((b.count / data.patientCount) * 100)}%)`,
                  }))}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-4" />
              Patients by gender
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.patientCount === 0 ? (
              <p className="text-sm text-muted-foreground">No patients yet.</p>
            ) : (
              <BarList
                items={data.genderDistribution
                  .filter((g) => g.count > 0)
                  .map((g) => ({
                    label: g.label,
                    value: g.count,
                    displayValue: `${g.count} (${Math.round((g.count / data.patientCount) * 100)}%)`,
                  }))}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="size-4" />
              New patients by month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-40 items-end gap-4">
              {(() => {
                const max = Math.max(1, ...data.newPatientsByMonth.map((m) => m.count));
                return data.newPatientsByMonth.map((m) => (
                  <div key={m.key} className="flex flex-1 flex-col items-center gap-2">
                    <span className="text-xs text-muted-foreground">{m.count}</span>
                    <div className="flex w-full flex-1 items-end">
                      <div
                        className="w-full rounded-t-md bg-primary"
                        style={{ height: `${Math.max(2, (m.count / max) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium">{m.label}</span>
                  </div>
                ));
              })()}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Pill className="size-4" />
              Top prescribed medicines
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.medicineTotals.length === 0 ? (
              <p className="text-sm text-muted-foreground">No prescriptions yet.</p>
            ) : (
              <BarList
                items={data.medicineTotals.map((m) => ({
                  label: data.medicineNameById.get(m.medicineId) ?? "Unknown",
                  value: m._sum.quantity ?? 0,
                  displayValue: `${m._sum.quantity ?? 0} units`,
                }))}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Appointments by status</CardTitle>
          </CardHeader>
          <CardContent>
            {data.totalAppointments === 0 ? (
              <p className="text-sm text-muted-foreground">No appointments yet.</p>
            ) : (
              <BarList
                items={data.statusTotals.map((s) => ({
                  label: s.status,
                  value: s._count.status,
                  displayValue: `${s._count.status} (${Math.round((s._count.status / data.totalAppointments) * 100)}%)`,
                  colorClass: STATUS_BAR_COLORS[s.status],
                }))}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserX className="size-4" />
              No-shows by doctor
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.noShowsByDoctor.length === 0 ? (
              <p className="text-sm text-muted-foreground">No no-shows recorded.</p>
            ) : (
              <BarList
                items={data.noShowsByDoctor.map((d) => ({
                  label: d.name,
                  value: d.count,
                  displayValue: `${d.count}`,
                  colorClass: "bg-orange-400",
                }))}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

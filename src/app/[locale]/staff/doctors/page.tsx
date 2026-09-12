import { Calendar, CalendarOff, Clock, Pencil, Plus, Stethoscope } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/authz";
import { todayRange } from "@/lib/queue";
import { formatTime } from "@/lib/clinic-hours";
import { WEEKDAY_LABELS } from "@/lib/doctor-availability";
import { initials } from "@/lib/format";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { UserActionDialog } from "@/components/staff/user-action-dialog";
import { DoctorAvailabilityForm } from "@/components/staff/doctor-availability-form";
import { DoctorLeaveManager } from "@/components/staff/doctor-leave-manager";

function formatWorkingDaysRange(workingDays: number[]) {
  if (workingDays.length === 0) return "No working days set";
  const sorted = [...workingDays].sort((a, b) => a - b);
  const isContiguous = sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1);
  if (isContiguous) {
    return sorted.length === 1
      ? WEEKDAY_LABELS[sorted[0]]
      : `${WEEKDAY_LABELS[sorted[0]]}-${WEEKDAY_LABELS[sorted[sorted.length - 1]]}`;
  }
  return sorted.map((d) => WEEKDAY_LABELS[d]).join(", ");
}

export default async function DoctorsSchedulesPage() {
  await requirePageRole(["ADMIN"]);

  const { start: todayStart, end: todayEnd } = todayRange();

  const [doctors, todaysAppointmentCounts] = await Promise.all([
    prisma.doctorProfile.findMany({
      include: {
        user: true,
        leaveDays: {
        where: { date: { gte: todayStart }, status: { not: "REJECTED" } },
        orderBy: { date: "asc" },
      },
      },
      orderBy: { user: { name: "asc" } },
    }),
    prisma.appointment.groupBy({
      by: ["doctorId"],
      where: { scheduledAt: { gte: todayStart, lt: todayEnd } },
      _count: { _all: true },
    }),
  ]);

  const todayCountByDoctorId = new Map(
    todaysAppointmentCounts.map((c) => [c.doctorId, c._count._all])
  );

  const onLeaveToday = new Set(
    doctors
      .filter((d) =>
        d.leaveDays.some((l) => l.status === "APPROVED" && l.date.getTime() === todayStart.getTime())
      )
      .map((d) => d.id)
  );

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Doctors &amp; Schedules</h1>
          <p className="text-sm text-muted-foreground">
            Manage doctor availability and schedules.
          </p>
        </div>
        <Button asChild>
          <Link href="/staff/users/new?role=DOCTOR">
            <Plus className="size-4" />
            Add Doctor
          </Link>
        </Button>
      </div>

      {doctors.length === 0 ? (
        <EmptyState icon={Stethoscope} message="No doctors on staff yet." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {doctors.map((doctor) => {
            const isOnLeave = onLeaveToday.has(doctor.id);
            const todayCount = todayCountByDoctorId.get(doctor.id) ?? 0;
            return (
              <Card key={doctor.id}>
                <CardContent className="grid gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <Avatar className="size-11">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {initials(doctor.user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold">{doctor.user.name}</p>
                        <p className="text-sm text-primary">{doctor.specialty ?? "General practice"}</p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        isOnLeave
                          ? "bg-orange-100 text-orange-700"
                          : "bg-emerald-100 text-emerald-700"
                      }
                    >
                      {isOnLeave ? "On Leave" : "Available"}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Clock className="size-4" />
                      {formatWorkingDaysRange(doctor.workingDays)}{" "}
                      {doctor.workStartTime && doctor.workEndTime
                        ? `${formatTime(doctor.workStartTime)}–${formatTime(doctor.workEndTime)}`
                        : ""}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Calendar className="size-4" />
                      {todayCount} today
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <UserActionDialog
                      title={`Edit Schedule — ${doctor.user.name}`}
                      trigger={
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-700"
                        >
                          <Pencil className="size-3.5" />
                          Edit Schedule
                        </Button>
                      }
                    >
                      <DoctorAvailabilityForm
                        doctorId={doctor.id}
                        workingDays={doctor.workingDays}
                        workStartTime={doctor.workStartTime}
                        workEndTime={doctor.workEndTime}
                      />
                    </UserActionDialog>

                    <UserActionDialog
                      title={`Leave Request — ${doctor.user.name}`}
                      trigger={
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 border-orange-200 text-orange-700 hover:bg-orange-50 hover:text-orange-700"
                        >
                          <CalendarOff className="size-3.5" />
                          Leave Request
                        </Button>
                      }
                    >
                      <DoctorLeaveManager doctorId={doctor.id} leaveDays={doctor.leaveDays} canDecide />
                    </UserActionDialog>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Schedule Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Doctor</TableHead>
                <TableHead>Specialty</TableHead>
                {WEEKDAY_LABELS.map((label) => (
                  <TableHead key={label} className="text-center">
                    {label}
                  </TableHead>
                ))}
                <TableHead>Hours</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {doctors.map((doctor) => (
                <TableRow key={doctor.id}>
                  <TableCell className="font-medium">{doctor.user.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {doctor.specialty ?? "—"}
                  </TableCell>
                  {WEEKDAY_LABELS.map((label, index) => (
                    <TableCell key={label} className="text-center">
                      {doctor.workingDays.includes(index) ? (
                        <span className="text-emerald-600">●</span>
                      ) : (
                        <span className="text-muted-foreground/30">—</span>
                      )}
                    </TableCell>
                  ))}
                  <TableCell className="text-muted-foreground">
                    {doctor.workStartTime && doctor.workEndTime
                      ? `${formatTime(doctor.workStartTime)}–${formatTime(doctor.workEndTime)}`
                      : "Clinic default"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

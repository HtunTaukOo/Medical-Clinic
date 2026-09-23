import { Calendar, CalendarOff, Clock, Pencil, Plus, Stethoscope } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/authz";
import { todayRange } from "@/lib/queue";
import { formatTime, clinicWeekday, getClinicHoursForDate } from "@/lib/clinic-hours";
import { WEEKDAY_LABELS, isWorkingDay, isWithinShiftRanges } from "@/lib/doctor-availability";
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

function formatRangeList(ranges: { startTime: string; endTime: string }[]) {
  return ranges.map((r) => `${formatTime(r.startTime)}–${formatTime(r.endTime)}`).join(", ");
}

// Shows the doctor's actual hours rather than a vague "Custom hours" label,
// as a list of lines (one per day-group) rather than one run-on joined
// string — a doctor with a split shift on one day and uniform hours the
// rest of the week reads as two short lines instead of a single long
// sentence. Working days that share an identical set of ranges are grouped
// together (e.g. "Mon-Sat: 9:00 AM–5:00 PM" as one line); a day with a
// genuinely different schedule gets its own line (e.g. "Mon: 9:00 AM–12:00
// PM, 1:00 PM–3:00 PM" / "Tue-Sat: 10:00 AM–6:00 PM"). A working day with no
// shift rows falls back to the clinic's default hours, shown as such.
function shiftGroupLines(
  workingDays: number[],
  shifts: { weekday: number; startTime: string; endTime: string }[]
): string[] {
  if (workingDays.length === 0) return ["No working days set"];

  const rangesByWeekday = new Map<number, { startTime: string; endTime: string }[]>();
  for (const day of workingDays) rangesByWeekday.set(day, []);
  for (const s of shifts) {
    rangesByWeekday.get(s.weekday)?.push(s);
  }

  const sorted = [...workingDays].sort((a, b) => a - b);
  const groups: { days: number[]; label: string }[] = [];
  for (const day of sorted) {
    const ranges = [...(rangesByWeekday.get(day) ?? [])].sort((a, b) =>
      a.startTime.localeCompare(b.startTime)
    );
    const label = ranges.length === 0 ? "Clinic default hours" : formatRangeList(ranges);
    const last = groups[groups.length - 1];
    if (last && last.label === label && last.days[last.days.length - 1] === day - 1) {
      last.days.push(day);
    } else {
      groups.push({ days: [day], label });
    }
  }

  return groups.map((g) => `${formatWorkingDaysRange(g.days)}: ${g.label}`);
}

// Mirrors the gating logic in doctor-week-schedule.tsx: working today, the
// clinic actually open today, and (falling back to the clinic's own hours
// for that day when the doctor has no explicit shift rows) the current time
// within one of the applicable ranges.
function isDoctorAvailableNow(
  workingDays: number[],
  shiftsToday: { startTime: string; endTime: string }[],
  clinicToday: { isOpen: boolean; openTime: string; closeTime: string },
  now: Date
) {
  if (!isWorkingDay(workingDays, now)) return false;
  if (!clinicToday.isOpen) return false;
  const effectiveRanges =
    shiftsToday.length > 0 ? shiftsToday : [{ startTime: clinicToday.openTime, endTime: clinicToday.closeTime }];
  return isWithinShiftRanges(now, effectiveRanges);
}

export default async function DoctorsSchedulesPage() {
  await requirePageRole(["ADMIN"]);

  const { start: todayStart, end: todayEnd } = todayRange();
  const now = new Date();
  const todayWeekday = clinicWeekday(now);

  const [allDoctors, todaysAppointmentCounts, allShifts, serviceSpecialties, clinicToday] = await Promise.all([
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
    prisma.doctorShift.findMany({
      orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
      select: { doctorId: true, weekday: true, startTime: true, endTime: true },
    }),
    prisma.specialty.findMany({ where: { bookingMode: "SERVICE_CAPACITY" }, select: { name: true } }),
    getClinicHoursForDate(now),
  ]);

  // SERVICE_CAPACITY specialties (e.g. Lab Visit) are backed by a placeholder
  // DoctorProfile that exists only as a foreign-key target for appointments —
  // it has no real schedule/hours/leave to manage, so it's excluded here.
  const serviceSpecialtyNames = new Set(serviceSpecialties.map((s) => s.name));
  const doctors = allDoctors.filter((d) => !d.specialty || !serviceSpecialtyNames.has(d.specialty));

  const todayCountByDoctorId = new Map(
    todaysAppointmentCounts.map((c) => [c.doctorId, c._count._all])
  );

  const shiftsByDoctorId = new Map<string, { weekday: number; startTime: string; endTime: string }[]>();
  for (const shift of allShifts) {
    const list = shiftsByDoctorId.get(shift.doctorId) ?? [];
    list.push(shift);
    shiftsByDoctorId.set(shift.doctorId, list);
  }

  const onLeaveToday = new Set(
    doctors
      .filter((d) =>
        d.leaveDays.some((l) => l.status === "APPROVED" && l.date.getTime() === todayStart.getTime())
      )
      .map((d) => d.id)
  );

  // Every doctor's upcoming leave (pending + approved) in one place, so an
  // admin doesn't have to open each doctor's own dialog to find requests
  // that need a decision — pending ones surface first, then by date.
  const allLeaveRequests = doctors
    .flatMap((d) => d.leaveDays.map((leave) => ({ ...leave, doctorName: d.user.name })))
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "PENDING" ? -1 : 1;
      return a.date.getTime() - b.date.getTime();
    });
  const pendingLeaveCount = allLeaveRequests.filter((l) => l.status === "PENDING").length;

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
            const doctorShifts = shiftsByDoctorId.get(doctor.id) ?? [];
            const shiftsToday = doctorShifts.filter((s) => s.weekday === todayWeekday);
            const isAvailableNow =
              !isOnLeave && isDoctorAvailableNow(doctor.workingDays, shiftsToday, clinicToday, now);
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
                          : isAvailableNow
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-600"
                      }
                    >
                      {isOnLeave ? "On Leave" : isAvailableNow ? "Available" : "Unavailable"}
                    </Badge>
                  </div>

                  <div className="grid gap-1.5 text-sm text-muted-foreground">
                    <div className="flex items-start gap-1.5">
                      <Clock className="mt-0.5 size-4 shrink-0" />
                      <div className="grid gap-0.5">
                        {shiftGroupLines(doctor.workingDays, doctorShifts).map((line) => (
                          <span key={line}>{line}</span>
                        ))}
                      </div>
                    </div>
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
                        shifts={doctorShifts}
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
          <CardTitle className="flex items-center gap-2">
            Leave Requests
            {pendingLeaveCount > 0 && (
              <Badge variant="outline" className="bg-amber-100 text-amber-700">
                {pendingLeaveCount} pending
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DoctorLeaveManager
            leaveDays={allLeaveRequests}
            showForm={false}
            canDecide
            emptyMessage="No upcoming leave requests."
          />
        </CardContent>
      </Card>

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
                  <TableCell className="whitespace-normal text-muted-foreground">
                    <div className="grid gap-0.5">
                      {shiftGroupLines(doctor.workingDays, shiftsByDoctorId.get(doctor.id) ?? []).map(
                        (line) => (
                          <div key={line}>{line}</div>
                        )
                      )}
                    </div>
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

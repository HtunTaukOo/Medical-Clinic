import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, CalendarCheck2, CalendarClock, CalendarX2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/authz";
import { Link } from "@/i18n/navigation";
import {
  getClinicHoursRange,
  toMinutes,
  formatTime,
  clinicDateKey,
  clinicMidnightForYMD,
} from "@/lib/clinic-hours";
import { APPOINTMENT_SLOT_MINUTES } from "@/lib/scheduling";
import { blockContainingMinuteOfDay, formatTimeLabel } from "@/lib/time-blocks";
import { getBlocksForDate } from "@/lib/booking-slots";
import { getDoctorShiftsByWeekday, isWithinShiftRanges } from "@/lib/doctor-availability";
import { DoctorLeaveManager } from "@/components/staff/doctor-leave-manager";
import { RequestLeaveDialog } from "@/components/staff/request-leave-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function parseWeekStart(value: string | undefined) {
  if (value) {
    const [year, month, day] = value.split("-").map(Number);
    if (year && month && day) {
      const asDate = clinicMidnightForYMD(year, month, day);
      const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
      const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
      return new Date(asDate.getTime() + mondayOffset * ONE_DAY_MS);
    }
  }
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Yangon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);
  const todayMidnight = clinicMidnightForYMD(year, month, day);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  return new Date(todayMidnight.getTime() + mondayOffset * ONE_DAY_MS);
}

function weekKeyFor(date: Date) {
  return clinicDateKey(date);
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const session = await requirePageRole(["DOCTOR"]);
  const doctorId = session.user.doctorId;
  if (!doctorId) notFound();

  const { week } = await searchParams;
  const weekStart = parseWeekStart(week);
  const weekEnd = new Date(weekStart.getTime() + 6 * ONE_DAY_MS);
  const prevWeek = new Date(weekStart.getTime() - 7 * ONE_DAY_MS);
  const nextWeek = new Date(weekStart.getTime() + 7 * ONE_DAY_MS);
  const todayKey = clinicDateKey(new Date());

  const [doctor, clinicHours, weekAppointments, upcomingLeaveDays, weekLeaveDays, shiftsByWeekday] =
    await Promise.all([
      prisma.doctorProfile.findUnique({ where: { id: doctorId } }),
      getClinicHoursRange(),
      prisma.appointment.findMany({
        where: {
          doctorId,
          status: { in: ["REQUESTED", "CONFIRMED", "CHECKED_IN", "COMPLETED"] },
          scheduledAt: { gte: weekStart, lt: new Date(weekEnd.getTime() + ONE_DAY_MS) },
        },
        include: { patient: { select: { name: true } } },
      }),
      prisma.doctorLeave.findMany({
        where: { doctorId, date: { gte: new Date() }, status: { not: "REJECTED" } },
        orderBy: { date: "asc" },
      }),
      prisma.doctorLeave.findMany({
        where: {
          doctorId,
          date: { gte: weekStart, lt: new Date(weekEnd.getTime() + ONE_DAY_MS) },
          status: { not: "REJECTED" },
        },
      }),
      getDoctorShiftsByWeekday(doctorId),
    ]);
  if (!doctor) notFound();

  const specialty = doctor.specialty
    ? await prisma.specialty.findUnique({ where: { name: doctor.specialty } })
    : null;
  const isBlockMode = specialty?.bookingMode === "BLOCK_CAPACITY";

  const approvedLeaveDayKeys = new Set(
    weekLeaveDays.filter((l) => l.status === "APPROVED").map((l) => weekKeyFor(l.date))
  );
  const pendingLeaveDayKeys = new Set(
    weekLeaveDays.filter((l) => l.status === "PENDING").map((l) => weekKeyFor(l.date))
  );
  const now = new Date().getTime();
  const rangeLabel = `${weekStart.toLocaleDateString(undefined, {
    timeZone: "Asia/Yangon",
    month: "short",
    day: "numeric",
  })} – ${weekEnd.toLocaleDateString(undefined, {
    timeZone: "Asia/Yangon",
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;

  // BLOCK_CAPACITY doctors: each weekday's own generated blocks instead of a
  // 30-min grid — days can have different hours (e.g. a shorter Saturday),
  // so row labels are the union of every distinct block start time across
  // the week, and a day without a block at that time just renders an empty
  // cell rather than forcing one uniform block list on every day. Each cell
  // holds every one of THIS doctor's own patients booked into that block
  // (capacity is pooled across doctors, but this view is per-doctor) — an
  // array per cell, not a single value, so multiple patients sharing one
  // block all render instead of only the last one processed.
  if (isBlockMode) {
    type BlockOccupant = { id: string; patientName: string; reason: string | null };

    const dayBlocks = await Promise.all(
      DAY_LABELS.map((_, offset) => getBlocksForDate(new Date(weekStart.getTime() + offset * ONE_DAY_MS)))
    );
    const rowStartTimes = Array.from(new Set(dayBlocks.flat().map((b) => b.startTime))).sort();

    const apptsByCell = new Map<string, BlockOccupant[]>();
    for (const appt of weekAppointments) {
      const offsetDays = Math.floor((appt.scheduledAt.getTime() - weekStart.getTime()) / ONE_DAY_MS);
      if (offsetDays < 0 || offsetDays > 5) continue;
      const minutesOfDay = Math.round(
        (appt.scheduledAt.getTime() - (weekStart.getTime() + offsetDays * ONE_DAY_MS)) / 60000
      );
      const block = blockContainingMinuteOfDay(dayBlocks[offsetDays], minutesOfDay);
      if (!block) continue;
      const key = `${offsetDays}-${block.startTime}`;
      const list = apptsByCell.get(key) ?? [];
      list.push({ id: appt.id, patientName: appt.patient.name, reason: appt.reason });
      apptsByCell.set(key, list);
    }

    const bookedCount = weekAppointments.length;
    let availableCount = 0;
    let blockedCount = 0;

    type BlockCell =
      | { type: "booked"; occupants: BlockOccupant[] }
      | { type: "available" }
      | { type: "blocked" }
      | { type: "none" };

    const blockGrid: BlockCell[][] = rowStartTimes.map((startTime) =>
      DAY_LABELS.map((_, dayOffset) => {
        const block = dayBlocks[dayOffset].find((b) => b.startTime === startTime);
        if (!block) return { type: "none" };

        const occupants = apptsByCell.get(`${dayOffset}-${startTime}`) ?? [];
        if (occupants.length > 0) return { type: "booked", occupants };

        const dayMidnight = weekStart.getTime() + dayOffset * ONE_DAY_MS;
        const dayKey = weekKeyFor(new Date(dayMidnight));
        const weekdayIndex = 1 + dayOffset; // Mon=1 .. Sat=6
        const isWorking = doctor.workingDays.includes(weekdayIndex);
        const isLeave = approvedLeaveDayKeys.has(dayKey);
        const blockEndInstant = dayMidnight + toMinutes(block.endTime) * 60000;
        const isPast = blockEndInstant <= now;
        if (!isWorking || isLeave || isPast) {
          blockedCount++;
          return { type: "blocked" };
        }
        availableCount++;
        return { type: "available" };
      })
    );

    return (
      <div className="grid gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Schedule</h1>
            <p className="text-muted-foreground">Your weekly calendar and availability.</p>
          </div>
          <RequestLeaveDialog doctorId={doctor.id} />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-3 py-5">
              <div className="flex size-11 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                <CalendarCheck2 className="size-5" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{bookedCount}</p>
                <p className="text-sm text-muted-foreground">Booked</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 py-5">
              <div className="flex size-11 items-center justify-center rounded-full bg-sky-100 text-sky-600">
                <CalendarClock className="size-5" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{availableCount}</p>
                <p className="text-sm text-muted-foreground">Available Blocks</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 py-5">
              <div className="flex size-11 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                <CalendarX2 className="size-5" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{blockedCount}</p>
                <p className="text-sm text-muted-foreground">Blocked</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="py-4">
            <div className="mb-4 flex items-center justify-center gap-4">
              <Link
                href={`/doctor/schedule?week=${weekKeyFor(prevWeek)}`}
                className="flex size-8 items-center justify-center rounded-full border text-muted-foreground hover:bg-muted"
              >
                <ChevronLeft className="size-4" />
              </Link>
              <p className="font-semibold">Week of {rangeLabel}</p>
              <Link
                href={`/doctor/schedule?week=${weekKeyFor(nextWeek)}`}
                className="flex size-8 items-center justify-center rounded-full border text-muted-foreground hover:bg-muted"
              >
                <ChevronRight className="size-4" />
              </Link>
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[820px]">
                <div className="grid grid-cols-[110px_repeat(6,1fr)] gap-1">
                  <div />
                  {DAY_LABELS.map((label, dayOffset) => {
                    const dayKey = weekKeyFor(new Date(weekStart.getTime() + dayOffset * ONE_DAY_MS));
                    const isToday = dayKey === todayKey;
                    const dayDate = new Date(weekStart.getTime() + dayOffset * ONE_DAY_MS);
                    return (
                      <div
                        key={label}
                        className={cn(
                          "rounded-t-lg py-2 text-center text-xs font-semibold tracking-wide text-muted-foreground",
                          isToday && "bg-primary/10 text-primary"
                        )}
                      >
                        <p>{label.toUpperCase()}</p>
                        <p className="text-sm font-semibold text-foreground">
                          {dayDate.toLocaleDateString(undefined, {
                            timeZone: "Asia/Yangon",
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                        {pendingLeaveDayKeys.has(dayKey) && (
                          <p className="text-[10px] font-medium text-amber-600">Leave pending</p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {rowStartTimes.map((startTime, rowIndex) => (
                  <div key={startTime} className="grid grid-cols-[110px_repeat(6,1fr)] gap-1">
                    <div className="flex items-start justify-end pr-2 pt-2 text-xs text-muted-foreground">
                      {formatTimeLabel(startTime)}
                    </div>
                    {blockGrid[rowIndex].map((cell, dayOffset) => {
                      const dayKey = weekKeyFor(new Date(weekStart.getTime() + dayOffset * ONE_DAY_MS));
                      const isToday = dayKey === todayKey;
                      return (
                        <div
                          key={dayOffset}
                          className={cn("min-h-16 rounded-lg p-1", isToday && "bg-primary/5")}
                        >
                          {cell.type === "booked" && (
                            <div className="grid h-full gap-1">
                              {cell.occupants.map((occupant) => (
                                <Link
                                  key={occupant.id}
                                  href={`/doctor/appointments/${occupant.id}`}
                                  className="block rounded-lg border border-blue-300 bg-blue-50 p-1.5 text-blue-900 transition-colors hover:bg-blue-100"
                                >
                                  <p className="text-xs leading-tight font-semibold">
                                    {occupant.patientName}
                                  </p>
                                  {occupant.reason && (
                                    <p className="text-[11px] leading-tight text-blue-700">
                                      {occupant.reason}
                                    </p>
                                  )}
                                </Link>
                              ))}
                            </div>
                          )}
                          {cell.type === "available" && (
                            <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-blue-200 bg-blue-50/40 text-[11px] font-medium text-blue-500">
                              Available
                            </div>
                          )}
                          {cell.type === "blocked" && (
                            <div className="flex h-full items-center justify-center rounded-lg bg-muted/40 text-[11px] text-muted-foreground/60">
                              Blocked
                            </div>
                          )}
                          {cell.type === "none" && <div className="h-full" />}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Blocked time &amp; leave requests</CardTitle>
          </CardHeader>
          <CardContent>
            <DoctorLeaveManager doctorId={doctor.id} leaveDays={upcomingLeaveDays} showForm={false} />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Row range spans the union of every working day's shifts (falling back to
  // the clinic's own hours for days with no specific shifts recorded) — a
  // shared set of grid rows across all 6 day-columns, with per-day/per-row
  // gating below marking cells outside that day's own shifts as blocked
  // (e.g. a lunch-break gap on a split-shift day).
  const allShiftsThisWeek = doctor.workingDays.flatMap((wd) => shiftsByWeekday.get(wd) ?? []);
  const startMinutes = Math.min(
    toMinutes(clinicHours.openTime),
    ...allShiftsThisWeek.map((s) => toMinutes(s.startTime))
  );
  const endMinutes = Math.max(
    toMinutes(clinicHours.closeTime),
    ...allShiftsThisWeek.map((s) => toMinutes(s.endTime))
  );
  const rowMinutes: number[] = [];
  for (let m = startMinutes; m < endMinutes; m += APPOINTMENT_SLOT_MINUTES) rowMinutes.push(m);

  type Occupant = { appt: (typeof weekAppointments)[number]; isStart: boolean };
  const apptByCell = new Map<string, Occupant>();
  for (const appt of weekAppointments) {
    const offsetDays = Math.floor((appt.scheduledAt.getTime() - weekStart.getTime()) / ONE_DAY_MS);
    if (offsetDays < 0 || offsetDays > 5) continue;
    const minutesOfDay = Math.round(
      (appt.scheduledAt.getTime() - (weekStart.getTime() + offsetDays * ONE_DAY_MS)) / 60000
    );
    const slotCount = Math.max(1, Math.round(appt.durationMinutes / APPOINTMENT_SLOT_MINUTES));
    for (let i = 0; i < slotCount; i++) {
      const m = minutesOfDay + i * APPOINTMENT_SLOT_MINUTES;
      apptByCell.set(`${offsetDays}-${m}`, { appt, isStart: i === 0 });
    }
  }

  const bookedCount = weekAppointments.length;
  let availableCount = 0;
  let blockedCount = 0;

  type Cell =
    | { type: "booked"; id: string; patientName: string; reason: string | null }
    | { type: "booked-continuation" }
    | { type: "available" }
    | { type: "blocked" };

  const grid: Cell[][] = rowMinutes.map((minutes) =>
    DAY_LABELS.map((_, dayOffset) => {
      const occupant = apptByCell.get(`${dayOffset}-${minutes}`);
      if (occupant) {
        return occupant.isStart
          ? {
              type: "booked",
              id: occupant.appt.id,
              patientName: occupant.appt.patient.name,
              reason: occupant.appt.reason,
            }
          : { type: "booked-continuation" };
      }
      const dayMidnight = weekStart.getTime() + dayOffset * ONE_DAY_MS;
      const dayKey = weekKeyFor(new Date(dayMidnight));
      const weekdayIndex = 1 + dayOffset; // Mon=1 .. Sat=6
      const isWorking = doctor.workingDays.includes(weekdayIndex);
      const isLeave = approvedLeaveDayKeys.has(dayKey);
      const isPast = dayMidnight + minutes * 60000 <= now;
      const dayShifts = shiftsByWeekday.get(weekdayIndex) ?? [];
      const withinShifts = isWithinShiftRanges(new Date(dayMidnight + minutes * 60000), dayShifts);
      if (!isWorking || isLeave || isPast || !withinShifts) {
        blockedCount++;
        return { type: "blocked" };
      }
      availableCount++;
      return { type: "available" };
    })
  );

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Schedule</h1>
          <p className="text-muted-foreground">Your weekly calendar and availability.</p>
        </div>
        <RequestLeaveDialog doctorId={doctor.id} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 py-5">
            <div className="flex size-11 items-center justify-center rounded-full bg-blue-100 text-blue-600">
              <CalendarCheck2 className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{bookedCount}</p>
              <p className="text-sm text-muted-foreground">Booked</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-5">
            <div className="flex size-11 items-center justify-center rounded-full bg-sky-100 text-sky-600">
              <CalendarClock className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{availableCount}</p>
              <p className="text-sm text-muted-foreground">Available Slots</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-5">
            <div className="flex size-11 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <CalendarX2 className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{blockedCount}</p>
              <p className="text-sm text-muted-foreground">Blocked</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="py-4">
          <div className="mb-4 flex items-center justify-center gap-4">
            <Link
              href={`/doctor/schedule?week=${weekKeyFor(prevWeek)}`}
              className="flex size-8 items-center justify-center rounded-full border text-muted-foreground hover:bg-muted"
            >
              <ChevronLeft className="size-4" />
            </Link>
            <p className="font-semibold">Week of {rangeLabel}</p>
            <Link
              href={`/doctor/schedule?week=${weekKeyFor(nextWeek)}`}
              className="flex size-8 items-center justify-center rounded-full border text-muted-foreground hover:bg-muted"
            >
              <ChevronRight className="size-4" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[720px]">
              <div className="grid grid-cols-[80px_repeat(6,1fr)] gap-1">
                <div />
                {DAY_LABELS.map((label, dayOffset) => {
                  const dayKey = weekKeyFor(new Date(weekStart.getTime() + dayOffset * ONE_DAY_MS));
                  const isToday = dayKey === todayKey;
                  const dayDate = new Date(weekStart.getTime() + dayOffset * ONE_DAY_MS);
                  return (
                    <div
                      key={label}
                      className={cn(
                        "rounded-t-lg py-2 text-center text-xs font-semibold tracking-wide text-muted-foreground",
                        isToday && "bg-primary/10 text-primary"
                      )}
                    >
                      <p>{label.toUpperCase()}</p>
                      <p className="text-sm font-semibold text-foreground">
                        {dayDate.toLocaleDateString(undefined, {
                          timeZone: "Asia/Yangon",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                      {pendingLeaveDayKeys.has(dayKey) && (
                        <p className="text-[10px] font-medium text-amber-600">Leave pending</p>
                      )}
                    </div>
                  );
                })}
              </div>

              {rowMinutes.map((minutes, rowIndex) => {
                const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
                const mm = String(minutes % 60).padStart(2, "0");
                return (
                  <div key={minutes} className="grid grid-cols-[80px_repeat(6,1fr)] gap-1">
                    <div className="flex items-start justify-end pr-2 pt-2 text-xs text-muted-foreground">
                      {formatTime(`${hh}:${mm}`)}
                    </div>
                    {grid[rowIndex].map((cell, dayOffset) => {
                      const dayKey = weekKeyFor(new Date(weekStart.getTime() + dayOffset * ONE_DAY_MS));
                      const isToday = dayKey === todayKey;
                      return (
                        <div
                          key={dayOffset}
                          className={cn("min-h-14 rounded-lg p-1", isToday && "bg-primary/5")}
                        >
                          {cell.type === "booked" && (
                            <Link
                              href={`/doctor/appointments/${cell.id}`}
                              className="block h-full rounded-lg border border-blue-300 bg-blue-50 p-2 text-blue-900 transition-colors hover:bg-blue-100"
                            >
                              <p className="text-xs leading-tight font-semibold">{cell.patientName}</p>
                              {cell.reason && (
                                <p className="text-[11px] leading-tight text-blue-700">{cell.reason}</p>
                              )}
                            </Link>
                          )}
                          {cell.type === "booked-continuation" && (
                            <div className="h-full rounded-lg border border-blue-200 bg-blue-50/70" />
                          )}
                          {cell.type === "available" && (
                            <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-blue-200 bg-blue-50/40 text-[11px] font-medium text-blue-500">
                              Available
                            </div>
                          )}
                          {cell.type === "blocked" && (
                            <div className="flex h-full items-center justify-center rounded-lg bg-muted/40 text-[11px] text-muted-foreground/60">
                              Blocked
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Blocked time &amp; leave requests</CardTitle>
        </CardHeader>
        <CardContent>
          <DoctorLeaveManager doctorId={doctor.id} leaveDays={upcomingLeaveDays} showForm={false} />
        </CardContent>
      </Card>
    </div>
  );
}

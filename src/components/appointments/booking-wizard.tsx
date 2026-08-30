"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Check } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import {
  fetchDaySlots,
  fetchMonthBookability,
  confirmBooking,
} from "@/actions/booking";
import type { DaySlot } from "@/lib/booking-slots";
import type { AppointmentFormState } from "@/actions/appointments";
import { SPECIALTY_TAXONOMY } from "@/lib/specialties";
import { getMonthGrid, addMonths, MONTH_NAMES } from "@/lib/calendar";
import { JoinWaitlistForm } from "@/components/appointments/join-waitlist-form";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

type Doctor = {
  id: string;
  name: string;
  initials: string;
  specialty: string;
  experienceYears: number | null;
  qualifications: string | null;
  slotsAvailableToday: number;
  nextAvailability: { label: string; year: number; month: number; day: number } | null;
};

type YMD = { year: number; month: number; day: number };

const STEPS = ["Specialty", "Doctor", "Date & Time", "Details", "Confirm"];

const REASON_OPTIONS = [
  "Routine Check-up",
  "Follow-up",
  "New Symptom",
  "Lab Results Review",
  "Prescription Renewal",
  "Other",
];

function isSameDay(a: YMD | null, b: YMD) {
  return a?.year === b.year && a?.month === b.month && a?.day === b.day;
}

function isPastDay(d: YMD, today: YMD) {
  if (d.year !== today.year) return d.year < today.year;
  if (d.month !== today.month) return d.month < today.month;
  return d.day < today.day;
}

function formatDateLabel(d: YMD) {
  return new Date(d.year, d.month - 1, d.day).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTimeLabel(time: string) {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

export function BookingWizard({ doctors, today }: { doctors: Doctor[]; today: YMD }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [specialty, setSpecialty] = useState<string | null>(null);
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [calendarYear, setCalendarYear] = useState(today.year);
  const [calendarMonth, setCalendarMonth] = useState(today.month);
  const [date, setDate] = useState<YMD | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [daySlots, setDaySlots] = useState<DaySlot[]>([]);
  const [slotsPending, startSlotsTransition] = useTransition();
  const [monthBookability, setMonthBookability] = useState<Record<number, boolean>>({});
  const [monthPending, startMonthTransition] = useTransition();
  const [reasonCategory, setReasonCategory] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [submitState, setSubmitState] = useState<AppointmentFormState>({});
  const [submitPending, startSubmitTransition] = useTransition();

  const specialties = useMemo(
    () =>
      SPECIALTY_TAXONOMY.map((s) => ({
        ...s,
        count: doctors.filter((d) => d.specialty === s.name).length,
      })),
    [doctors]
  );

  const doctorsForSpecialty = useMemo(
    () => doctors.filter((d) => d.specialty === specialty),
    [doctors, specialty]
  );

  const selectedDoctor = doctors.find((d) => d.id === doctorId) ?? null;

  useEffect(() => {
    if (!doctorId) return;
    startMonthTransition(async () => {
      const result = await fetchMonthBookability(doctorId, calendarYear, calendarMonth);
      setMonthBookability(result);
    });
  }, [doctorId, calendarYear, calendarMonth]);

  function pickDate(d: YMD) {
    if (!doctorId) return;
    setDate(d);
    setTime(null);
    setDaySlots([]);
    startSlotsTransition(async () => {
      const result = await fetchDaySlots(doctorId, d.year, d.month, d.day);
      setDaySlots(result);
    });
  }

  function handleConfirm() {
    if (!doctorId || !date || !time || !reasonCategory) return;
    const reason = notes ? `${reasonCategory}: ${notes}` : reasonCategory;
    startSubmitTransition(async () => {
      const result = await confirmBooking(doctorId, date.year, date.month, date.day, time, reason);
      setSubmitState(result);
      if (result.success) setStep(6);
    });
  }

  if (step === 6 && submitState.success) {
    return (
      <div className="mx-auto grid max-w-2xl justify-items-center gap-4 py-8 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-success/10">
          <Check className="size-9 text-success" />
        </div>
        <h1 className="text-2xl font-bold">Appointment requested</h1>
        <p className="max-w-sm text-muted-foreground">
          We&apos;ll confirm your booking shortly. You can track its status in My Appointments.
        </p>
        <div className="grid w-full max-w-sm gap-0 rounded-xl border bg-card text-sm shadow-sm">
          {[
            ["Specialty", specialty],
            ["Doctor", selectedDoctor?.name],
            ["Date", date && formatDateLabel(date)],
            ["Time", time && formatTimeLabel(time)],
            ["Reason", reasonCategory],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between border-b p-3 last:border-b-0">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-medium">{value}</span>
            </div>
          ))}
        </div>
        <Button size="lg" className="w-full max-w-sm" onClick={() => router.push("/portal/appointments")}>
          Done
        </Button>
      </div>
    );
  }

  const monthGrid = getMonthGrid(calendarYear, calendarMonth);
  const prevMonth = addMonths(calendarYear, calendarMonth, -1);
  const nextMonth = addMonths(calendarYear, calendarMonth, 1);
  const canContinue =
    (step === 1 && !!specialty) ||
    (step === 2 && !!doctorId) ||
    (step === 3 && !!date && !!time) ||
    (step === 4 && !!reasonCategory);

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-6">
      <div>
        <h1 className="text-2xl font-bold">Book an Appointment</h1>
        <p className="text-muted-foreground">Choose your specialty, doctor, date, and time.</p>
      </div>

      <div className="flex items-center justify-center">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const isDone = n < step;
          const isCurrent = n === step;
          return (
            <div key={label} className="flex flex-1 items-center last:flex-none">
              <div className="grid justify-items-center gap-1.5">
                <div
                  className={`flex size-9 items-center justify-center rounded-full text-sm font-semibold ${
                    isDone
                      ? "bg-primary text-primary-foreground"
                      : isCurrent
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isDone ? <Check className="size-4" /> : n}
                </div>
                <span
                  className={`text-xs font-medium whitespace-nowrap ${isCurrent ? "text-primary" : "text-muted-foreground"}`}
                >
                  {label}
                </span>
              </div>
              {n < STEPS.length && (
                <div className={`mx-2 h-0.5 flex-1 ${isDone ? "bg-primary" : "bg-muted"}`} />
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        {step === 1 && (
          <div className="grid gap-6">
            <h2 className="text-xl font-semibold">Choose a Specialty</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {specialties.map((s) => {
                const selected = specialty === s.name;
                return (
                  <button
                    key={s.name}
                    type="button"
                    onClick={() => setSpecialty(s.name)}
                    className={`rounded-xl border p-4 text-left transition-colors ${
                      selected ? "border-primary ring-1 ring-primary" : "hover:bg-muted/50"
                    }`}
                  >
                    <span className="text-2xl">{s.emoji}</span>
                    <p className="mt-2 font-semibold">{s.name}</p>
                    <p className="text-sm text-muted-foreground">{s.description}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-6">
            <div>
              <h2 className="text-xl font-semibold">Select a Doctor</h2>
              <p className="text-muted-foreground">{specialty}</p>
            </div>
            {doctorsForSpecialty.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No doctors available in this specialty yet.
              </p>
            ) : (
              <div className="grid gap-3">
                {doctorsForSpecialty.map((d) => {
                  const selected = doctorId === d.id;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setDoctorId(d.id)}
                      className={`flex items-center gap-4 rounded-xl border p-4 text-left transition-colors ${
                        selected ? "border-primary ring-1 ring-primary" : "hover:bg-muted/50"
                      }`}
                    >
                      <Avatar className="size-12">
                        <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                          {d.initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="grid gap-0.5">
                        <p className="font-semibold">{d.name}</p>
                        {d.qualifications && (
                          <p className="text-sm text-muted-foreground">{d.qualifications}</p>
                        )}
                        <p className="text-sm text-muted-foreground">
                          {d.experienceYears != null && `${d.experienceYears} yrs exp. · `}
                          {d.slotsAvailableToday > 0 ? (
                            <span className="text-success">
                              {d.slotsAvailableToday} slot{d.slotsAvailableToday === 1 ? "" : "s"} available today
                            </span>
                          ) : d.nextAvailability ? (
                            <span className="text-muted-foreground">
                              Next available: {d.nextAvailability.label}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Fully booked</span>
                          )}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="grid gap-3">
              <h2 className="text-xl font-semibold">Pick a Date &amp; Time</h2>
              <div className="flex items-center justify-between">
                <p className="font-medium">
                  {MONTH_NAMES[calendarMonth - 1]} {calendarYear}
                </p>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() => {
                      setCalendarYear(prevMonth.year);
                      setCalendarMonth(prevMonth.month);
                    }}
                  >
                    ‹
                  </Button>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() => {
                      setCalendarYear(nextMonth.year);
                      setCalendarMonth(nextMonth.month);
                    }}
                  >
                    ›
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div key={d}>{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {monthGrid.flat().map((d, i) => {
                  const inMonth = d.getMonth() === calendarMonth - 1;
                  const ymd: YMD = { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
                  const past = isPastDay(ymd, today);
                  const bookable = inMonth && !past && monthBookability[ymd.day] !== false;
                  const selected = isSameDay(date, ymd);
                  return (
                    <button
                      key={i}
                      type="button"
                      aria-label={
                        inMonth
                          ? `${ymd.year}-${String(ymd.month).padStart(2, "0")}-${String(ymd.day).padStart(2, "0")}`
                          : undefined
                      }
                      disabled={!inMonth || past || !bookable || monthPending}
                      onClick={() => pickDate(ymd)}
                      className={`aspect-square rounded-lg text-sm transition-colors ${
                        !inMonth
                          ? "invisible"
                          : selected
                            ? "bg-primary font-semibold text-primary-foreground"
                            : !bookable || past
                              ? "text-muted-foreground/40"
                              : "hover:bg-muted"
                      }`}
                    >
                      {d.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-3">
              <p className="font-medium">
                {date ? `Available Times — ${formatDateLabel(date)}` : "Pick a date first"}
              </p>
              {!date ? (
                <p className="text-sm text-muted-foreground">
                  Select a date on the calendar to see open times.
                </p>
              ) : slotsPending ? (
                <p className="text-sm text-muted-foreground">Loading times…</p>
              ) : daySlots.length === 0 ? (
                <p className="text-sm text-muted-foreground">No available times on this day.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {daySlots.map((s) => (
                    <button
                      key={s.time}
                      type="button"
                      disabled={!s.available}
                      onClick={() => setTime(s.time)}
                      className={`rounded-lg border py-2.5 text-sm font-medium transition-colors ${
                        time === s.time
                          ? "border-primary bg-primary text-primary-foreground"
                          : s.available
                            ? "hover:bg-muted/50"
                            : "text-muted-foreground/40 line-through"
                      }`}
                    >
                      {formatTimeLabel(s.time)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="grid gap-6">
            <h2 className="text-xl font-semibold">Visit Details</h2>
            <div className="grid gap-2">
              <Label>
                Reason for Visit <span className="text-destructive">*</span>
              </Label>
              <div className="grid gap-2 sm:grid-cols-3">
                {REASON_OPTIONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setReasonCategory(r)}
                    className={`rounded-lg border py-2.5 text-sm font-medium transition-colors ${
                      reasonCategory === r
                        ? "border-primary bg-primary/5 text-primary ring-1 ring-primary"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">Additional Notes</Label>
              <Textarea
                id="notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Describe your symptoms or anything else the doctor should know…"
              />
            </div>
          </div>
        )}

        {step === 5 && selectedDoctor && date && time && (
          <div className="grid gap-6">
            <h2 className="text-xl font-semibold">Confirm Appointment</h2>
            <div className="grid gap-0 rounded-xl bg-muted/50 text-sm">
              {[
                ["Specialty", specialty],
                ["Doctor", selectedDoctor.name],
                ["Date", formatDateLabel(date)],
                ["Time", formatTimeLabel(time)],
                ["Reason", reasonCategory],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between p-3">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium">{value}</span>
                </div>
              ))}
            </div>
            <div className="rounded-lg bg-primary/5 p-3 text-sm text-primary">
              <span className="font-medium">Reminder:</span> Please arrive 10 minutes early. Bring
              your ID and any previous medical records.
            </div>
            {submitState.error && <p className="text-sm text-destructive">{submitState.error}</p>}
            {submitState.conflict && (
              <div className="grid gap-2">
                <p className="text-sm text-muted-foreground">
                  That time was just taken. Pick a different time, or join the waitlist for it.
                </p>
                <JoinWaitlistForm
                  doctorId={submitState.conflict.doctorId}
                  scheduledAt={submitState.conflict.scheduledAt}
                  reason={submitState.conflict.reason}
                />
              </div>
            )}
          </div>
        )}

        <div className="mt-8 flex items-center justify-between">
          <Button
            variant="outline"
            disabled={step === 1}
            onClick={() => setStep((s) => Math.max(1, s - 1))}
          >
            Back
          </Button>
          {step < 5 ? (
            <Button disabled={!canContinue} onClick={() => setStep((s) => s + 1)}>
              Continue
            </Button>
          ) : (
            <Button disabled={submitPending} onClick={handleConfirm}>
              {submitPending ? "Booking…" : "Confirm Booking"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

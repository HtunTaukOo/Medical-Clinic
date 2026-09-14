"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  fetchDaySlots,
  fetchMonthBookability,
  confirmBooking,
  fetchResourceDaySlots,
  fetchResourceMonthBookability,
  confirmResourceBooking,
} from "@/actions/booking";
import type { DaySlot } from "@/lib/booking-slots";
import type { AppointmentFormState } from "@/actions/appointments";
import { getSpecialtyIcon, matchSpecialty } from "@/lib/specialties";
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

type Service = {
  id: string;
  name: string;
  specialty: string | null;
  durationMinutes: number;
  price: number;
};

type SpecialtyOption = {
  name: string;
  icon: string;
  description: string | null;
  bookByService: boolean;
  capacityPerSlot: number;
};

type YMD = { year: number; month: number; day: number };

// Auto-assigns a doctor of record for "book by service" specialties, where
// the patient picks a service instead of a doctor (e.g. Laboratory) and
// availability is capacity-based rather than tied to any one doctor's
// calendar. Sorted deterministically by id so this always agrees with the
// server's own pick in confirmResourceBooking (which re-resolves the doctor
// independently rather than trusting whatever the client sends).
function pickAutoDoctor(pool: Doctor[]): Doctor | null {
  if (pool.length === 0) return null;
  return [...pool].sort((a, b) => a.id.localeCompare(b.id))[0];
}

// Keep in sync with MAX_APPOINTMENT_SLOTS in src/lib/scheduling.ts (a
// server-only module this client component can't import directly).
const MAX_SLOTS = 3;

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

function formatKyat(value: number) {
  return `K ${Math.round(value).toLocaleString()}`;
}

function addMinutesToTime(time: string, minutesToAdd: number) {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutesToAdd;
  const hh = String(Math.floor(total / 60) % 24).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

// How many consecutive 30-min slots starting at `time` are free, capped at
// `cap` — powers the duration picker (30/60/90 min) so it only offers
// options that are actually bookable back-to-back.
function maxConsecutiveAvailable(daySlots: DaySlot[], time: string, cap: number) {
  const startIndex = daySlots.findIndex((s) => s.time === time);
  if (startIndex === -1) return 0;
  let count = 0;
  for (let i = startIndex; i < daySlots.length && count < cap; i++) {
    if (!daySlots[i].available) break;
    count++;
  }
  return count;
}

export function BookingWizard({
  doctors,
  services,
  specialtyOptions,
  today,
}: {
  doctors: Doctor[];
  services: Service[];
  specialtyOptions: SpecialtyOption[];
  today: YMD;
}) {
  const t = useTranslations("portal.booking");
  const router = useRouter();
  const REASON_OPTIONS = [
    t("reasonRoutine"),
    t("reasonFollowUp"),
    t("reasonNewSymptom"),
    t("reasonLabReview"),
    t("reasonRxRenewal"),
    t("reasonOther"),
  ];
  const [step, setStep] = useState(1);
  const [specialty, setSpecialty] = useState<string | null>(null);
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [clinicServiceId, setClinicServiceId] = useState<string | null>(null);
  const [calendarYear, setCalendarYear] = useState(today.year);
  const [calendarMonth, setCalendarMonth] = useState(today.month);
  const [date, setDate] = useState<YMD | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [slotCount, setSlotCount] = useState(1);
  const [daySlots, setDaySlots] = useState<DaySlot[]>([]);
  const [slotsPending, startSlotsTransition] = useTransition();
  const [monthBookability, setMonthBookability] = useState<Record<number, boolean>>({});
  const [monthPending, startMonthTransition] = useTransition();
  const [reasonCategory, setReasonCategory] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [submitState, setSubmitState] = useState<AppointmentFormState>({});
  const [submitPending, startSubmitTransition] = useTransition();

  const specialtyNames = useMemo(() => specialtyOptions.map((s) => s.name), [specialtyOptions]);

  const specialties = useMemo(
    () =>
      specialtyOptions.map((s) => ({
        ...s,
        count: doctors.filter((d) => d.specialty === s.name).length,
      })),
    [specialtyOptions, doctors]
  );

  const doctorsForSpecialty = useMemo(
    () => doctors.filter((d) => d.specialty === specialty),
    [doctors, specialty]
  );

  const servicesForSpecialty = useMemo(
    () => services.filter((s) => matchSpecialty(s.specialty, specialtyNames) === specialty),
    [services, specialty, specialtyNames]
  );

  const currentSpecialtyOption = specialtyOptions.find((s) => s.name === specialty) ?? null;
  const isBookByService = currentSpecialtyOption?.bookByService ?? false;
  const steps = [
    t("stepSpecialty"),
    isBookByService ? t("stepService") : t("stepDoctor"),
    t("stepDateTime"),
    t("stepDetails"),
    t("stepConfirm"),
  ];

  const selectedDoctor = doctors.find((d) => d.id === doctorId) ?? null;
  const selectedService = services.find((s) => s.id === clinicServiceId) ?? null;
  const timeRangeLabel = time
    ? slotCount > 1
      ? `${formatTimeLabel(time)} – ${formatTimeLabel(addMinutesToTime(time, slotCount * 30))} (${slotCount * 30} min)`
      : formatTimeLabel(time)
    : null;

  useEffect(() => {
    if (!doctorId) return;
    startMonthTransition(async () => {
      const result = isBookByService
        ? await fetchResourceMonthBookability(calendarYear, calendarMonth)
        : await fetchMonthBookability(doctorId, calendarYear, calendarMonth);
      setMonthBookability(result);
    });
  }, [doctorId, isBookByService, calendarYear, calendarMonth]);

  function pickDate(d: YMD) {
    if (!doctorId) return;
    setDate(d);
    setTime(null);
    setSlotCount(1);
    setDaySlots([]);
    startSlotsTransition(async () => {
      const result =
        isBookByService && currentSpecialtyOption
          ? await fetchResourceDaySlots(
              currentSpecialtyOption.name,
              currentSpecialtyOption.capacityPerSlot,
              d.year,
              d.month,
              d.day
            )
          : await fetchDaySlots(doctorId, d.year, d.month, d.day);
      setDaySlots(result);
    });
  }

  // The fewest 30-min slots that actually cover the selected service's
  // duration — the floor a patient can't book under, so a longer test can't
  // be shortened into a slot where the next patient's visit would overlap it.
  const minSlots = selectedService ? Math.min(Math.ceil(selectedService.durationMinutes / 30), MAX_SLOTS) : 1;

  function pickTime(t: string) {
    setTime(t);
    const maxAvailable = maxConsecutiveAvailable(daySlots, t, MAX_SLOTS);
    setSlotCount(Math.min(Math.max(minSlots, 1), Math.max(maxAvailable, 1)));
  }

  function handleConfirm() {
    if (!doctorId || !date || !time || !reasonCategory) return;
    const reason = notes ? `${reasonCategory}: ${notes}` : reasonCategory;
    const durationMinutes = slotCount * 30;
    startSubmitTransition(async () => {
      const result =
        isBookByService && currentSpecialtyOption
          ? await confirmResourceBooking(
              currentSpecialtyOption.name,
              date.year,
              date.month,
              date.day,
              time,
              reason,
              durationMinutes,
              clinicServiceId
            )
          : await confirmBooking(
              doctorId,
              date.year,
              date.month,
              date.day,
              time,
              reason,
              durationMinutes,
              clinicServiceId
            );
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
        <h1 className="text-2xl font-bold">{t("requested")}</h1>
        <p className="max-w-sm text-muted-foreground">{t("requestedBody")}</p>
        <div className="grid w-full max-w-sm gap-0 rounded-xl border bg-card text-sm shadow-sm">
          {[
            [t("summarySpecialty"), specialty],
            [t("summaryDoctor"), selectedDoctor?.name],
            ...(selectedService ? [[t("summaryService"), selectedService.name]] : []),
            [t("summaryDate"), date && formatDateLabel(date)],
            [t("summaryTime"), timeRangeLabel],
            [t("summaryReason"), reasonCategory],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between border-b p-3 last:border-b-0">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-medium">{value}</span>
            </div>
          ))}
        </div>
        <Button size="lg" className="w-full max-w-sm" onClick={() => router.push("/portal/appointments")}>
          {t("done")}
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
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">
          {isBookByService ? t("subtitleService") : t("subtitleDoctor")}
        </p>
      </div>

      <div className="flex items-center justify-center">
        {steps.map((label, i) => {
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
              {n < steps.length && (
                <div className={`mx-2 h-0.5 flex-1 ${isDone ? "bg-primary" : "bg-muted"}`} />
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        {step === 1 && (
          <div className="grid gap-6">
            <h2 className="text-xl font-semibold">{t("chooseSpecialty")}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {specialties.map((s) => {
                const selected = specialty === s.name;
                const Icon = getSpecialtyIcon(s.icon);
                return (
                  <button
                    key={s.name}
                    type="button"
                    onClick={() => {
                      setSpecialty(s.name);
                      setDoctorId(null);
                      setClinicServiceId(null);
                    }}
                    className={`rounded-xl border p-4 text-left transition-colors ${
                      selected ? "border-primary ring-1 ring-primary" : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex size-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                      <Icon className="size-5" />
                    </div>
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
              <h2 className="text-xl font-semibold">
                {isBookByService ? t("selectService") : t("selectDoctor")}
              </h2>
              <p className="text-muted-foreground">{specialty}</p>
            </div>

            {isBookByService ? (
              servicesForSpecialty.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noServicesConfigured")}</p>
              ) : doctorsForSpecialty.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noStaffConfigured")}</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {servicesForSpecialty.map((s) => {
                    const selected = clinicServiceId === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          const autoDoctor = pickAutoDoctor(doctorsForSpecialty);
                          if (!autoDoctor) return;
                          setClinicServiceId(s.id);
                          setDoctorId(autoDoctor.id);
                          setReasonCategory(s.name);
                        }}
                        className={`rounded-xl border p-4 text-left transition-colors ${
                          selected ? "border-primary ring-1 ring-primary" : "hover:bg-muted/50"
                        }`}
                      >
                        <p className="font-semibold">{s.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {s.durationMinutes} min · {formatKyat(s.price)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )
            ) : (
              <>
                {servicesForSpecialty.length > 0 && (
                  <div className="grid gap-2">
                    <Label>{t("specificServiceOptional")}</Label>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {servicesForSpecialty.map((s) => {
                        const selected = clinicServiceId === s.id;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              if (selected) {
                                setClinicServiceId(null);
                                setReasonCategory((r) => (r === s.name ? null : r));
                              } else {
                                setClinicServiceId(s.id);
                                setReasonCategory(s.name);
                              }
                            }}
                            className={`rounded-lg border p-3 text-left transition-colors ${
                              selected
                                ? "border-primary bg-primary/5 ring-1 ring-primary"
                                : "hover:bg-muted/50"
                            }`}
                          >
                            <p className="text-sm font-medium">{s.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {s.durationMinutes} min · {formatKyat(s.price)}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {doctorsForSpecialty.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("noDoctorsAvailable")}</p>
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
                              {d.experienceYears != null && t("yearsExp", { years: d.experienceYears })}
                              {d.slotsAvailableToday > 0 ? (
                                <span className="text-success">
                                  {t("slotsAvailableToday", { count: d.slotsAvailableToday })}
                                </span>
                              ) : d.nextAvailability ? (
                                <span className="text-muted-foreground">
                                  {t("nextAvailable", { label: d.nextAvailability.label })}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">{t("noUpcomingAvailability")}</span>
                              )}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="grid gap-3">
              <h2 className="text-xl font-semibold">{t("pickDateTime")}</h2>
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
                {[
                  t("weekdaySun"), t("weekdayMon"), t("weekdayTue"), t("weekdayWed"),
                  t("weekdayThu"), t("weekdayFri"), t("weekdaySat"),
                ].map((d, i) => (
                  <div key={i}>{d}</div>
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
                {date ? t("availableTimesFor", { date: formatDateLabel(date) }) : t("pickDateFirst")}
              </p>
              {!date ? (
                <p className="text-sm text-muted-foreground">{t("selectDatePrompt")}</p>
              ) : slotsPending ? (
                <p className="text-sm text-muted-foreground">{t("loadingTimes")}</p>
              ) : daySlots.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noAvailableTimes")}</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {daySlots.map((s) => (
                    <button
                      key={s.time}
                      type="button"
                      disabled={!s.available}
                      onClick={() => pickTime(s.time)}
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

              {time && (
                <div className="grid gap-2">
                  <p className="text-sm font-medium">{t("reserveMoreTime")}</p>
                  {minSlots > 1 && (
                    <p className="text-xs text-muted-foreground">
                      {t("minDurationHint", {
                        service: selectedService?.name ?? "",
                        duration: selectedService?.durationMinutes ?? 0,
                        min: minSlots * 30,
                      })}
                    </p>
                  )}
                  <div className="flex gap-2">
                    {Array.from({ length: MAX_SLOTS }, (_, i) => i + 1).map((n) => {
                      const maxAvailable = maxConsecutiveAvailable(daySlots, time, MAX_SLOTS);
                      const disabled = n > maxAvailable || n < minSlots;
                      return (
                        <button
                          key={n}
                          type="button"
                          disabled={disabled}
                          onClick={() => setSlotCount(n)}
                          className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
                            slotCount === n
                              ? "border-primary bg-primary text-primary-foreground"
                              : disabled
                                ? "text-muted-foreground/40"
                                : "hover:bg-muted/50"
                          }`}
                        >
                          {n * 30} min
                        </button>
                      );
                    })}
                  </div>
                  {slotCount > 1 && (
                    <p className="text-xs text-muted-foreground">
                      {formatTimeLabel(time)} – {formatTimeLabel(addMinutesToTime(time, slotCount * 30))}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="grid gap-6">
            <h2 className="text-xl font-semibold">{t("visitDetails")}</h2>
            <div className="grid gap-2">
              <Label>
                {t("reasonForVisit")} <span className="text-destructive">*</span>
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
              <Label htmlFor="notes">{t("additionalNotes")}</Label>
              <Textarea
                id="notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("notesPlaceholder")}
              />
            </div>
          </div>
        )}

        {step === 5 && selectedDoctor && date && time && (
          <div className="grid gap-6">
            <h2 className="text-xl font-semibold">{t("confirmAppointment")}</h2>
            <div className="grid gap-0 rounded-xl bg-muted/50 text-sm">
              {[
                [t("summarySpecialty"), specialty],
                [t("summaryDoctor"), selectedDoctor.name],
                ...(selectedService ? [[t("summaryService"), selectedService.name]] : []),
                [t("summaryDate"), formatDateLabel(date)],
                [t("summaryTime"), timeRangeLabel],
                [t("summaryReason"), reasonCategory],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between p-3">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium">{value}</span>
                </div>
              ))}
            </div>
            <div className="rounded-lg bg-primary/5 p-3 text-sm text-primary">
              <span className="font-medium">{t("reminderLabel")}</span> {t("reminderBody")}
            </div>
            {submitState.error && <p className="text-sm text-destructive">{submitState.error}</p>}
            {submitState.conflict && (
              <div className="grid gap-2">
                <p className="text-sm text-muted-foreground">{t("slotTakenMessage")}</p>
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
            {t("back")}
          </Button>
          {step < 5 ? (
            <Button disabled={!canContinue} onClick={() => setStep((s) => s + 1)}>
              {t("continue")}
            </Button>
          ) : (
            <Button disabled={submitPending} onClick={handleConfirm}>
              {submitPending ? t("booking") : t("confirmBooking")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

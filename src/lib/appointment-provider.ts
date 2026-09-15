import { prisma } from "@/lib/prisma";
import { formatClinicDateTime } from "@/lib/clinic-hours";

// For book-by-service specialties (e.g. Lab Visit) the assigned doctor is
// just an Appointment.doctorId FK placeholder — the patient booked a
// specific service, not a person — so the patient-facing UI should show the
// service name instead of the placeholder's name.
export async function getBookByServiceSpecialtyNames(): Promise<Set<string>> {
  const specialties = await prisma.specialty.findMany({
    where: { bookingMode: "SERVICE_CAPACITY" },
    select: { name: true },
  });
  return new Set(specialties.map((s) => s.name));
}

// SERVICE_CAPACITY and BLOCK_CAPACITY both mean the patient picked a time
// block, not an exact minute — scheduledAt is just that block's start, so
// anywhere displaying the appointment's time should show the full block
// range (see formatAppointmentTime below), not scheduledAt alone.
export async function getRangeBookingSpecialtyNames(): Promise<Set<string>> {
  const specialties = await prisma.specialty.findMany({
    where: { bookingMode: { in: ["SERVICE_CAPACITY", "BLOCK_CAPACITY"] } },
    select: { name: true },
  });
  return new Set(specialties.map((s) => s.name));
}

// For call sites that already have a single appointment's doctor.specialty
// on hand (booking/confirm/reschedule/cancel notification text) and just
// need one yes/no answer — avoids the Set-building query when there's only
// one appointment to check.
export async function isSpecialtyRangeBooking(specialtyName: string | null): Promise<boolean> {
  if (!specialtyName) return false;
  const specialty = await prisma.specialty.findUnique({
    where: { name: specialtyName },
    select: { bookingMode: true },
  });
  return specialty ? specialty.bookingMode !== "DOCTOR_CALENDAR" : false;
}

// For doctor-portal pages scoped to a single logged-in doctor (dashboard,
// appointments list, consultations list) — every appointment there shares
// that one doctor's specialty, so one lookup covers the whole page instead
// of needing getRangeBookingSpecialtyNames + a per-appointment check.
export async function isDoctorRangeBooking(doctorId: string): Promise<boolean> {
  const doctor = await prisma.doctorProfile.findUnique({
    where: { id: doctorId },
    select: { specialty: true },
  });
  if (!doctor?.specialty) return false;
  const specialty = await prisma.specialty.findUnique({
    where: { name: doctor.specialty },
    select: { bookingMode: true },
  });
  return specialty ? specialty.bookingMode !== "DOCTOR_CALENDAR" : false;
}

export function isRangeBookingAppointment(
  appt: { doctor: { specialty: string | null } },
  rangeBookingNames: Set<string>
): boolean {
  return !!appt.doctor.specialty && rangeBookingNames.has(appt.doctor.specialty);
}

// scheduledAt is always the block's start — durationMinutes (already a plain
// column on every Appointment, no extra query needed) gives the end without
// having to re-derive that day's generated blocks. isRangeBooking comes from
// isRangeBookingAppointment/getRangeBookingSpecialtyNames above.
export function formatAppointmentTime(
  appt: { scheduledAt: Date; durationMinutes: number },
  isRangeBooking: boolean,
  timeOptions: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" }
): string {
  const start = formatClinicDateTime(appt.scheduledAt, timeOptions);
  if (!isRangeBooking) return start;
  const end = new Date(appt.scheduledAt.getTime() + appt.durationMinutes * 60 * 1000);
  return `${start} – ${formatClinicDateTime(end, timeOptions)}`;
}

// Combined date + time (range), for headers currently using
// `new Date(scheduledAt).toLocaleString()` — one date, not a repeated one
// per side of the range.
export function formatAppointmentDateTime(
  appt: { scheduledAt: Date; durationMinutes: number },
  isRangeBooking: boolean,
  dateOptions: Intl.DateTimeFormatOptions = { dateStyle: "medium" }
): string {
  const datePart = formatClinicDateTime(appt.scheduledAt, dateOptions);
  return `${datePart}, ${formatAppointmentTime(appt, isRangeBooking)}`;
}

export function appointmentProviderName(
  appt: {
    doctor: { specialty: string | null; user: { name: string } };
    clinicService?: { name: string } | null;
  },
  bookByServiceNames: Set<string>
): string {
  if (appt.clinicService && appt.doctor.specialty && bookByServiceNames.has(appt.doctor.specialty)) {
    return appt.clinicService.name;
  }
  return appt.doctor.user.name;
}

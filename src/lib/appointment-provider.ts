import { prisma } from "@/lib/prisma";

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

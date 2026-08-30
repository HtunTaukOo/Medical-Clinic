import { prisma } from "@/lib/prisma";
import { getNextAvailability, getAvailableSlots } from "@/lib/booking-slots";
import { clinicDateParts } from "@/lib/clinic-hours";
import { matchSpecialty } from "@/lib/specialties";
import { initials } from "@/lib/format";
import { BookingWizard } from "@/components/appointments/booking-wizard";

export default async function BookAppointmentPage() {
  const doctors = await prisma.doctorProfile.findMany({ include: { user: true } });
  const today = clinicDateParts(new Date());

  const withAvailability = await Promise.all(
    doctors.map(async (d) => {
      const nextAvailability = await getNextAvailability(d);
      const slotsToday = await getAvailableSlots(d, today.year, today.month, today.day);
      return {
        id: d.id,
        name: d.user.name,
        initials: initials(d.user.name),
        specialty: matchSpecialty(d.specialty) ?? d.specialty?.trim() ?? "General Medicine",
        experienceYears: d.experienceYears,
        qualifications: d.qualifications,
        slotsAvailableToday: slotsToday.length,
        nextAvailability,
      };
    })
  );

  return (
    <div className="grid gap-4">
      <BookingWizard doctors={withAvailability} today={today} />
    </div>
  );
}

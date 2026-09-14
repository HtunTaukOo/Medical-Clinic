import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { getNextAvailability, getAvailableSlots } from "@/lib/booking-slots";
import { clinicDateParts } from "@/lib/clinic-hours";
import { matchSpecialty } from "@/lib/specialties";
import { getActiveSpecialties } from "@/lib/specialties-data";
import { initials } from "@/lib/format";
import { BookingWizard } from "@/components/appointments/booking-wizard";

export default async function BookAppointmentPage() {
  const t = await getTranslations("portal.booking");
  const [doctors, clinicServices, specialties] = await Promise.all([
    prisma.doctorProfile.findMany({ include: { user: true } }),
    prisma.clinicService.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    getActiveSpecialties(),
  ]);
  const today = clinicDateParts(new Date());
  const specialtyNames = specialties.map((s) => s.name);
  const availabilityLabels = { today: t("todayLabel"), tomorrow: t("tomorrowLabel") };

  const withAvailability = await Promise.all(
    doctors.map(async (d) => {
      const nextAvailability = await getNextAvailability(d, new Date(), availabilityLabels);
      const slotsToday = await getAvailableSlots(d, today.year, today.month, today.day);
      return {
        id: d.id,
        name: d.user.name,
        initials: initials(d.user.name),
        specialty:
          matchSpecialty(d.specialty, specialtyNames) ?? d.specialty?.trim() ?? t("generalMedicineFallback"),
        experienceYears: d.experienceYears,
        qualifications: d.qualifications,
        slotsAvailableToday: slotsToday.length,
        nextAvailability,
      };
    })
  );

  const services = clinicServices.map((s) => ({
    id: s.id,
    name: s.name,
    specialty: s.specialty,
    durationMinutes: s.durationMinutes,
    price: Number(s.price),
  }));

  const specialtyOptions = specialties.map((s) => ({
    name: s.name,
    icon: s.icon,
    description: s.description,
    bookingMode: s.bookingMode,
    capacityPerSlot: s.capacityPerSlot,
  }));

  return (
    <div className="grid gap-4">
      <BookingWizard
        doctors={withAvailability}
        services={services}
        specialtyOptions={specialtyOptions}
        today={today}
      />
    </div>
  );
}

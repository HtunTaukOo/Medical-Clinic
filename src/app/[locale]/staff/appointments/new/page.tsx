import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/authz";
import { createAppointment } from "@/actions/appointments";
import { AppointmentForm } from "@/components/appointments/appointment-form";
import { BackLink } from "@/components/back-link";

export default async function NewAppointmentPage({
  searchParams,
}: {
  searchParams: Promise<{ patientId?: string }>;
}) {
  await requirePageRole(["ADMIN", "STAFF"]);
  const t = await getTranslations("appointments");
  const { patientId } = await searchParams;

  const [patients, doctors, blockSpecialties, serviceSpecialties, clinicServices] = await Promise.all([
    prisma.patient.findMany({ orderBy: { name: "asc" } }),
    prisma.doctorProfile.findMany({ include: { user: true } }),
    prisma.specialty.findMany({
      where: { bookingMode: "BLOCK_CAPACITY" },
      select: { name: true, capacityPerSlot: true },
    }),
    prisma.specialty.findMany({
      where: { bookingMode: "SERVICE_CAPACITY" },
      select: { name: true, capacityPerSlot: true },
    }),
    prisma.clinicService.findMany({
      where: { active: true },
      select: { id: true, name: true, specialty: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const serviceSpecialtyNames = new Set(serviceSpecialties.map((s) => s.name));

  return (
    <div className="grid gap-4">
      <BackLink href="/staff/appointments" />
      <h1 className="text-2xl font-semibold">{t("new")}</h1>
      <AppointmentForm
        action={createAppointment}
        patients={patients.map((p) => ({ id: p.id, name: p.name }))}
        doctors={doctors
          .filter((d) => !d.specialty || !serviceSpecialtyNames.has(d.specialty))
          .map((d) => ({
            id: d.id,
            name: d.user.name,
            specialty: d.specialty,
          }))}
        blockSpecialties={blockSpecialties}
        serviceSpecialties={serviceSpecialties}
        clinicServices={clinicServices}
        redirectOnSuccess="/staff/appointments"
        defaultPatientId={patientId}
      />
    </div>
  );
}

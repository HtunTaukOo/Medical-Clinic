import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireStaffPermissionPage } from "@/lib/authz";
import { createAppointment } from "@/actions/appointments";
import { AppointmentForm } from "@/components/appointments/appointment-form";
import { BackLink } from "@/components/back-link";
import { Link } from "@/i18n/navigation";

export default async function NewAppointmentPage({
  searchParams,
}: {
  searchParams: Promise<{ patientId?: string }>;
}) {
  await requireStaffPermissionPage("CREATE_APPOINTMENTS");
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t("new")}</h1>
        <Link
          href={`/staff/appointments/schedule${patientId ? `?patientId=${patientId}` : ""}`}
          className="text-sm text-primary underline underline-offset-2"
        >
          Or pick a time from a doctor&apos;s schedule calendar
        </Link>
      </div>
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

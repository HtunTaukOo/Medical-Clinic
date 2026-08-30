import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/authz";
import { createAppointment } from "@/actions/appointments";
import { AppointmentForm } from "@/components/appointments/appointment-form";

export default async function NewAppointmentPage({
  searchParams,
}: {
  searchParams: Promise<{ patientId?: string }>;
}) {
  const session = await requirePageRole(["ADMIN", "RECEPTIONIST", "DOCTOR"]);
  const t = await getTranslations("appointments");
  const { patientId } = await searchParams;

  const [patients, doctors] = await Promise.all([
    prisma.patient.findMany({ orderBy: { name: "asc" } }),
    prisma.doctorProfile.findMany({ include: { user: true } }),
  ]);

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-semibold">{t("new")}</h1>
      <AppointmentForm
        action={createAppointment}
        patients={patients.map((p) => ({ id: p.id, name: p.name }))}
        doctors={doctors.map((d) => ({
          id: d.id,
          name: d.user.name,
          specialty: d.specialty,
        }))}
        redirectOnSuccess="/staff/appointments"
        defaultPatientId={patientId}
        defaultDoctorId={
          session.user.role === "DOCTOR" ? (session.user.doctorId ?? undefined) : undefined
        }
      />
    </div>
  );
}

import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { createAppointment } from "@/actions/appointments";
import { AppointmentForm } from "@/components/appointments/appointment-form";

export default async function NewAppointmentPage() {
  await requireRole(["ADMIN", "RECEPTIONIST"]);
  const t = await getTranslations("appointments");

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
      />
    </div>
  );
}

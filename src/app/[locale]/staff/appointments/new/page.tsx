import { getTranslations } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/authz";
import { createAppointment } from "@/actions/appointments";
import { AppointmentForm } from "@/components/appointments/appointment-form";
import { Link } from "@/i18n/navigation";

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
      <Link
        href="/staff/appointments"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Back
      </Link>
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

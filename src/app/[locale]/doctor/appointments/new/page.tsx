import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/authz";
import { createAppointment } from "@/actions/appointments";
import { AppointmentForm } from "@/components/appointments/appointment-form";
import { BackLink } from "@/components/back-link";

export default async function NewDoctorAppointmentPage({
  searchParams,
}: {
  searchParams: Promise<{ patientId?: string }>;
}) {
  const session = await requirePageRole(["DOCTOR"]);
  const t = await getTranslations("appointments");
  const { patientId } = await searchParams;
  const doctorId = session.user.doctorId;
  if (!doctorId) notFound();

  const [patients, doctor] = await Promise.all([
    prisma.patient.findMany({ orderBy: { name: "asc" } }),
    prisma.doctorProfile.findUnique({ where: { id: doctorId }, include: { user: true } }),
  ]);
  if (!doctor) notFound();

  return (
    <div className="grid gap-4">
      <BackLink href="/doctor/appointments" />
      <h1 className="text-2xl font-semibold">{t("new")}</h1>
      <AppointmentForm
        action={createAppointment}
        patients={patients.map((p) => ({ id: p.id, name: p.name }))}
        doctors={[{ id: doctor.id, name: doctor.user.name, specialty: doctor.specialty }]}
        redirectOnSuccess="/doctor/appointments"
        defaultPatientId={patientId}
        defaultDoctorId={doctor.id}
      />
    </div>
  );
}

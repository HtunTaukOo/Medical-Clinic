import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requestAppointment } from "@/actions/appointments";
import { AppointmentForm } from "@/components/appointments/appointment-form";
import { ClinicStatusBanner } from "@/components/clinic/clinic-status-banner";

export default async function NewPortalAppointmentPage({
  searchParams,
}: {
  searchParams: Promise<{ doctorId?: string }>;
}) {
  const t = await getTranslations("appointments");
  const { doctorId } = await searchParams;
  const doctors = await prisma.doctorProfile.findMany({ include: { user: true } });

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-semibold">{t("requestNew")}</h1>
      <ClinicStatusBanner />
      <AppointmentForm
        action={requestAppointment}
        doctors={doctors.map((d) => ({
          id: d.id,
          name: d.user.name,
          specialty: d.specialty,
        }))}
        redirectOnSuccess="/portal/appointments"
        defaultDoctorId={doctorId}
      />
    </div>
  );
}

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/authz";
import { DoctorWeekSchedule } from "@/components/appointments/doctor-week-schedule";

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; patientId?: string }>;
}) {
  const session = await requirePageRole(["DOCTOR"]);
  const doctorId = session.user.doctorId;
  if (!doctorId) notFound();

  const { week, patientId } = await searchParams;

  // This doctor's own existing patients, for the "book follow-up in this
  // open slot" quick-book dialog — same scope as My Patients.
  const patients = await prisma.patient.findMany({
    where: { OR: [{ appointments: { some: { doctorId } } }, { walkIns: { some: { doctorId } } }] },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <DoctorWeekSchedule
      doctorId={doctorId}
      weekParam={week}
      followUpPatientId={patientId}
      patients={patients}
      canRequestLeave
      basePath="/doctor/schedule"
      appointmentHref={(id) => `/doctor/appointments/${id}`}
    />
  );
}

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaffPermissionPage } from "@/lib/authz";
import { Link } from "@/i18n/navigation";
import { BackLink } from "@/components/back-link";
import { DoctorWeekSchedule } from "@/components/appointments/doctor-week-schedule";
import { Card, CardContent } from "@/components/ui/card";

export default async function StaffAppointmentSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ doctorId?: string; week?: string; patientId?: string }>;
}) {
  await requireStaffPermissionPage("CREATE_APPOINTMENTS");
  const { doctorId, week, patientId } = await searchParams;

  if (!doctorId) {
    // SERVICE_CAPACITY specialties (e.g. Lab Visit) auto-assign a doctor
    // server-side rather than having patients/staff pick one — same filter
    // /staff/appointments/new uses for its own doctor dropdown, since this
    // per-doctor availability calendar doesn't apply to that booking model.
    const serviceSpecialties = await prisma.specialty.findMany({
      where: { bookingMode: "SERVICE_CAPACITY" },
      select: { name: true },
    });
    const serviceSpecialtyNames = new Set(serviceSpecialties.map((s) => s.name));
    const doctors = await prisma.doctorProfile.findMany({
      include: { user: true },
      orderBy: { user: { name: "asc" } },
    });
    const realDoctors = doctors.filter((d) => !d.specialty || !serviceSpecialtyNames.has(d.specialty));

    return (
      <div className="grid gap-4">
        <BackLink href="/staff/appointments" />
        <div>
          <h1 className="text-2xl font-semibold">Schedule</h1>
          <p className="text-muted-foreground">Choose a doctor to view their weekly availability.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {realDoctors.map((d) => (
            <Link
              key={d.id}
              href={`/staff/appointments/schedule?doctorId=${d.id}${patientId ? `&patientId=${patientId}` : ""}`}
            >
              <Card className="transition-colors hover:bg-muted/50">
                <CardContent className="py-4">
                  <p className="font-medium">{d.user.name}</p>
                  {d.specialty && <p className="text-sm text-muted-foreground">{d.specialty}</p>}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  const doctor = await prisma.doctorProfile.findUnique({ where: { id: doctorId }, include: { user: true } });
  if (!doctor) notFound();

  // Staff can book any patient in with any doctor (not just that doctor's
  // existing patients), unlike the doctor-portal follow-up flow.
  const patients = await prisma.patient.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="grid gap-4">
      <BackLink href="/staff/appointments/schedule" />
      <DoctorWeekSchedule
        doctorId={doctor.id}
        weekParam={week}
        followUpPatientId={patientId}
        patients={patients}
        canRequestLeave={false}
        basePath="/staff/appointments/schedule"
        linkParams={{ doctorId: doctor.id, ...(patientId ? { patientId } : {}) }}
        appointmentHref={(id) => `/staff/appointments/${id}`}
        title={`${doctor.user.name}'s Schedule`}
        subtitle={doctor.specialty ?? "Weekly calendar and availability"}
      />
    </div>
  );
}

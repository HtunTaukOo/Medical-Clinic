import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/authz";
import { BackLink } from "@/components/back-link";
import { DoctorAvailabilityForm } from "@/components/staff/doctor-availability-form";
import { DoctorLeaveManager } from "@/components/staff/doctor-leave-manager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DoctorAvailabilityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageRole(["ADMIN"]);
  const { id } = await params;

  const [doctor, shifts] = await Promise.all([
    prisma.doctorProfile.findUnique({
      where: { id },
      include: {
        user: true,
        leaveDays: {
          orderBy: { date: "asc" },
          where: { date: { gte: new Date() }, status: { not: "REJECTED" } },
        },
      },
    }),
    prisma.doctorShift.findMany({
      where: { doctorId: id },
      orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
      select: { weekday: true, startTime: true, endTime: true },
    }),
  ]);

  if (!doctor) notFound();

  return (
    <div className="grid gap-6">
      <BackLink href="/staff/users?tab=doctors" />

      <div>
        <h1 className="text-2xl font-semibold">{doctor.user.name}</h1>
        <p className="text-muted-foreground">Working schedule & leave days</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Weekly schedule</CardTitle>
        </CardHeader>
        <CardContent>
          <DoctorAvailabilityForm doctorId={doctor.id} workingDays={doctor.workingDays} shifts={shifts} />
        </CardContent>
      </Card>

      <Card id="leave">
        <CardHeader>
          <CardTitle>Leave days</CardTitle>
        </CardHeader>
        <CardContent>
          <DoctorLeaveManager doctorId={doctor.id} leaveDays={doctor.leaveDays} canDecide />
        </CardContent>
      </Card>
    </div>
  );
}

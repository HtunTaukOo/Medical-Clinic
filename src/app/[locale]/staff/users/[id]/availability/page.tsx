import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { DoctorAvailabilityForm } from "@/components/staff/doctor-availability-form";
import { DoctorLeaveManager } from "@/components/staff/doctor-leave-manager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DoctorAvailabilityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["ADMIN"]);
  const { id } = await params;

  const doctor = await prisma.doctorProfile.findUnique({
    where: { id },
    include: {
      user: true,
      leaveDays: { orderBy: { date: "asc" }, where: { date: { gte: new Date() } } },
    },
  });

  if (!doctor) notFound();

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{doctor.user.name}</h1>
        <p className="text-muted-foreground">Working schedule & leave days</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Weekly schedule</CardTitle>
        </CardHeader>
        <CardContent>
          <DoctorAvailabilityForm
            doctorId={doctor.id}
            workingDays={doctor.workingDays}
            workStartTime={doctor.workStartTime}
            workEndTime={doctor.workEndTime}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Leave days</CardTitle>
        </CardHeader>
        <CardContent>
          <DoctorLeaveManager doctorId={doctor.id} leaveDays={doctor.leaveDays} />
        </CardContent>
      </Card>
    </div>
  );
}

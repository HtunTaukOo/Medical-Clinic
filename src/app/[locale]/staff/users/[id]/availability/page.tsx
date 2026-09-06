import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/authz";
import { Link } from "@/i18n/navigation";
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
      <Link
        href="/staff/doctors"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Back
      </Link>

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

      <Card id="leave">
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

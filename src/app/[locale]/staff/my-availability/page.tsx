import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { WEEKDAY_LABELS } from "@/lib/doctor-availability";
import { DoctorLeaveManager } from "@/components/staff/doctor-leave-manager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function MyAvailabilityPage() {
  const session = await requireRole(["DOCTOR"]);
  const doctorId = session.user.doctorId;
  if (!doctorId) notFound();

  const doctor = await prisma.doctorProfile.findUnique({
    where: { id: doctorId },
    include: {
      leaveDays: { orderBy: { date: "asc" }, where: { date: { gte: new Date() } } },
    },
  });
  if (!doctor) notFound();

  const workingDaysLabel = doctor.workingDays.length
    ? [...doctor.workingDays].sort((a, b) => a - b).map((d) => WEEKDAY_LABELS[d]).join(", ")
    : "None set";
  const hoursLabel =
    doctor.workStartTime && doctor.workEndTime
      ? `${doctor.workStartTime}–${doctor.workEndTime}`
      : "the clinic's default hours";

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">My Availability</h1>
        <p className="text-muted-foreground">
          Working days: {workingDaysLabel} · {hoursLabel}. To change your weekly
          schedule, contact an Admin — you can manage your own leave days below.
        </p>
      </div>

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

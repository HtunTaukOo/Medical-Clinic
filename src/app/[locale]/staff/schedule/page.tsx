import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/authz";
import { WEEKDAY_LABELS } from "@/lib/doctor-availability";
import { DoctorLeaveManager } from "@/components/staff/doctor-leave-manager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default async function SchedulePage() {
  const session = await requirePageRole(["DOCTOR"]);
  const doctorId = session.user.doctorId;
  if (!doctorId) notFound();

  const doctor = await prisma.doctorProfile.findUnique({
    where: { id: doctorId },
    include: {
      leaveDays: { orderBy: { date: "asc" }, where: { date: { gte: new Date() } } },
    },
  });
  if (!doctor) notFound();

  const hoursLabel =
    doctor.workStartTime && doctor.workEndTime
      ? `${doctor.workStartTime}–${doctor.workEndTime}`
      : "the clinic's default hours";

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Schedule</h1>
        <p className="text-muted-foreground">
          Your weekly working hours and blocked time. To change your weekly schedule, contact
          an Admin — you can manage your own leave days below.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Weekly availability</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2 text-center text-sm">
            {WEEKDAY_LABELS.map((label, index) => {
              const isWorking = doctor.workingDays.includes(index);
              return (
                <div
                  key={label}
                  className={cn(
                    "rounded-lg border p-3",
                    isWorking
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "text-muted-foreground/50"
                  )}
                >
                  <p className="font-medium">{label}</p>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-sm text-muted-foreground">Working hours: {hoursLabel}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Blocked time &amp; leave requests</CardTitle>
        </CardHeader>
        <CardContent>
          <DoctorLeaveManager doctorId={doctor.id} leaveDays={doctor.leaveDays} />
        </CardContent>
      </Card>
    </div>
  );
}

import { notFound } from "next/navigation";
import { CalendarOff } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { removeDoctorLeave } from "@/actions/staff";
import { DoctorAvailabilityForm } from "@/components/staff/doctor-availability-form";
import { DoctorLeaveForm } from "@/components/staff/doctor-leave-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";

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
        <CardContent className="grid gap-4">
          <DoctorLeaveForm doctorId={doctor.id} />
          {doctor.leaveDays.length === 0 ? (
            <EmptyState icon={CalendarOff} message="No upcoming leave days scheduled." />
          ) : (
            <div className="grid gap-2">
              {doctor.leaveDays.map((leave) => (
                <div
                  key={leave.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium">
                      {leave.date.toLocaleDateString(undefined, {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                    {leave.reason && (
                      <p className="text-sm text-muted-foreground">{leave.reason}</p>
                    )}
                  </div>
                  <form action={removeDoctorLeave.bind(null, leave.id)}>
                    <Button size="sm" variant="destructive" type="submit">
                      Remove
                    </Button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

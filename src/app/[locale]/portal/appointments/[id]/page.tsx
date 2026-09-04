import { notFound } from "next/navigation";
import { ChevronLeft, Pill } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { cancelAppointment, checkInAppointment } from "@/actions/appointments";
import { getQueuePosition, isWithinSelfCheckInWindow } from "@/lib/queue";
import { Link } from "@/i18n/navigation";
import { DiagnosisList } from "@/components/diagnoses/diagnosis-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";

export default async function PortalAppointmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const t = await getTranslations("appointments");
  const patientId = session?.user.patientId;
  const { id } = await params;

  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: {
      doctor: { include: { user: true } },
      prescriptions: { include: { items: { include: { medicine: true } } } },
      diagnoses: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!appointment || !patientId || appointment.patientId !== patientId) {
    notFound();
  }

  const canSelfCheckIn =
    appointment.status === "CONFIRMED" && isWithinSelfCheckInWindow(appointment.scheduledAt);
  const canCancel = appointment.status === "REQUESTED" || appointment.status === "CONFIRMED";
  const queuePosition =
    appointment.status === "CHECKED_IN" && appointment.checkedInAt
      ? await getQueuePosition(appointment.doctorId, appointment.checkedInAt)
      : null;

  return (
    <div className="grid gap-6">
      <Link
        href="/portal/appointments"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Back
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{appointment.doctor.user.name}</h1>
          <p className="text-muted-foreground">
            {new Date(appointment.scheduledAt).toLocaleString()}
          </p>
        </div>
        <Badge variant="outline">{appointment.status}</Badge>
      </div>

      {queuePosition != null && (
        <p className="text-sm font-medium text-primary">
          {t("queuePosition", { position: queuePosition, doctor: appointment.doctor.user.name })}
        </p>
      )}

      <div className="flex gap-2">
        {canSelfCheckIn && (
          <form action={checkInAppointment.bind(null, appointment.id)}>
            <Button type="submit" className="w-fit">
              {t("checkIn")}
            </Button>
          </form>
        )}
        {canCancel && (
          <form action={cancelAppointment.bind(null, appointment.id)}>
            <Button variant="destructive" type="submit" className="w-fit">
              {t("cancel")}
            </Button>
          </form>
        )}
      </div>

      {appointment.reason && (
        <Card>
          <CardHeader>
            <CardTitle>{t("reason")}</CardTitle>
          </CardHeader>
          <CardContent>{appointment.reason}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Diagnosis</CardTitle>
        </CardHeader>
        <CardContent>
          <DiagnosisList diagnoses={appointment.diagnoses} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Prescriptions</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {appointment.prescriptions.length === 0 ? (
            <EmptyState icon={Pill} message="No prescriptions for this visit." />
          ) : (
            appointment.prescriptions.map((rx) => (
              <div key={rx.id} className="rounded-md border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {new Date(rx.createdAt).toLocaleString()}
                  </span>
                  <Badge variant={rx.fulfilled ? "success" : "outline"}>
                    {rx.fulfilled ? "Fulfilled" : "Pending"}
                  </Badge>
                </div>
                <ul className="text-sm">
                  {rx.items.map((item) => (
                    <li key={item.id}>
                      {item.medicine.name} &mdash; {item.dosage} x{item.quantity}
                      {item.timesPerDay && item.durationDays && (
                        <span className="text-muted-foreground">
                          {" "}
                          (reminders: {item.timesPerDay}x/day for {item.durationDays} days)
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

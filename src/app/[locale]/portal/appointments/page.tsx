import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getQueuePosition, isWithinSelfCheckInWindow } from "@/lib/queue";
import { checkInAppointment } from "@/actions/appointments";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function PortalAppointmentsPage() {
  const session = await auth();
  const t = await getTranslations("appointments");
  const patientId = session?.user.patientId;

  const appointments = patientId
    ? await prisma.appointment.findMany({
        where: { patientId },
        orderBy: { scheduledAt: "desc" },
        include: { doctor: { include: { user: true } } },
      })
    : [];

  const queuePositions = new Map<string, number>();
  for (const appt of appointments) {
    if (appt.status === "CHECKED_IN" && appt.checkedInAt) {
      queuePositions.set(
        appt.id,
        await getQueuePosition(appt.doctorId, appt.checkedInAt)
      );
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <Button asChild>
          <Link href="/portal/appointments/new">{t("requestNew")}</Link>
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("scheduledAt")}</TableHead>
            <TableHead>{t("doctor")}</TableHead>
            <TableHead>{t("status")}</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {appointments.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-muted-foreground">
                {t("noResults")}
              </TableCell>
            </TableRow>
          )}
          {appointments.map((appt) => {
            const position = queuePositions.get(appt.id);
            const canSelfCheckIn =
              appt.status === "CONFIRMED" && isWithinSelfCheckInWindow(appt.scheduledAt);
            return (
              <TableRow key={appt.id}>
                <TableCell>{new Date(appt.scheduledAt).toLocaleString()}</TableCell>
                <TableCell>{appt.doctor.user.name}</TableCell>
                <TableCell>
                  <Badge variant="outline">{appt.status}</Badge>
                  {position !== undefined && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t("queuePosition", { position, doctor: appt.doctor.user.name })}
                    </p>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {canSelfCheckIn && (
                    <form action={checkInAppointment.bind(null, appt.id)}>
                      <Button size="sm" type="submit">
                        {t("checkIn")}
                      </Button>
                    </form>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

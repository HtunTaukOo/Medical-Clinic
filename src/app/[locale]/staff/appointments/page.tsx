import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import {
  confirmAppointment,
  checkInAppointment,
  cancelAppointment,
  completeAppointment,
} from "@/actions/appointments";
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

export default async function AppointmentsPage() {
  const session = await requireRole(["ADMIN", "DOCTOR", "RECEPTIONIST"]);
  const t = await getTranslations("appointments");

  const appointments = await prisma.appointment.findMany({
    where:
      session.user.role === "DOCTOR"
        ? { doctorId: session.user.doctorId }
        : undefined,
    orderBy: { scheduledAt: "desc" },
    include: { patient: true, doctor: { include: { user: true } } },
  });

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        {session.user.role !== "DOCTOR" && (
          <Button asChild>
            <Link href="/staff/appointments/new">{t("new")}</Link>
          </Button>
        )}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("scheduledAt")}</TableHead>
            <TableHead>{t("patient")}</TableHead>
            <TableHead>{t("doctor")}</TableHead>
            <TableHead>{t("status")}</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {appointments.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground">
                {t("noResults")}
              </TableCell>
            </TableRow>
          )}
          {appointments.map((appt) => (
            <TableRow key={appt.id}>
              <TableCell>
                <Link href={`/staff/appointments/${appt.id}`} className="underline">
                  {new Date(appt.scheduledAt).toLocaleString()}
                </Link>
              </TableCell>
              <TableCell>
                <Link href={`/staff/patients/${appt.patientId}`} className="underline">
                  {appt.patient.name}
                </Link>
              </TableCell>
              <TableCell>{appt.doctor.user.name}</TableCell>
              <TableCell>
                <Badge variant="outline">{appt.status}</Badge>
              </TableCell>
              <TableCell className="flex flex-wrap justify-end gap-2">
                {appt.status === "REQUESTED" && (
                  <form action={confirmAppointment.bind(null, appt.id)}>
                    <Button size="sm" variant="secondary" type="submit">
                      {t("confirm")}
                    </Button>
                  </form>
                )}
                {appt.status === "CONFIRMED" && session.user.role !== "DOCTOR" && (
                  <form action={checkInAppointment.bind(null, appt.id)}>
                    <Button size="sm" variant="secondary" type="submit">
                      {t("checkIn")}
                    </Button>
                  </form>
                )}
                {(appt.status === "REQUESTED" ||
                  appt.status === "CONFIRMED" ||
                  appt.status === "CHECKED_IN") && (
                  <>
                    <form action={completeAppointment.bind(null, appt.id)}>
                      <Button size="sm" type="submit">
                        {t("complete")}
                      </Button>
                    </form>
                    <form action={cancelAppointment.bind(null, appt.id)}>
                      <Button size="sm" variant="destructive" type="submit">
                        {t("cancel")}
                      </Button>
                    </form>
                  </>
                )}
                {session.user.role === "DOCTOR" &&
                  (appt.status === "CHECKED_IN" || appt.status === "COMPLETED") && (
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/staff/appointments/${appt.id}`}>
                      {t("writePrescription")}
                    </Link>
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

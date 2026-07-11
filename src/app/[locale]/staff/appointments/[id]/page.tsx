import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import {
  confirmAppointment,
  checkInAppointment,
  cancelAppointment,
  completeAppointment,
} from "@/actions/appointments";
import { createPrescription } from "@/actions/prescriptions";
import { PrescriptionForm } from "@/components/prescriptions/prescription-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default async function AppointmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireRole(["ADMIN", "DOCTOR", "RECEPTIONIST"]);
  const { id } = await params;
  const t = await getTranslations("appointments");
  const tBilling = await getTranslations("billing");

  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: {
      patient: true,
      doctor: { include: { user: true } },
      prescriptions: { include: { items: { include: { medicine: true } } } },
      invoice: true,
    },
  });

  if (!appointment) notFound();

  if (session.user.role === "DOCTOR" && appointment.doctorId !== session.user.doctorId) {
    notFound();
  }

  const isOwnDoctor =
    session.user.role === "DOCTOR" && appointment.doctorId === session.user.doctorId;
  const canPrescribe =
    isOwnDoctor &&
    (appointment.status === "CONFIRMED" ||
      appointment.status === "CHECKED_IN" ||
      appointment.status === "COMPLETED");

  const medicines = canPrescribe
    ? await prisma.medicine.findMany({ orderBy: { name: "asc" } })
    : [];

  const boundCreatePrescription = createPrescription.bind(null, appointment.id);

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{appointment.patient.name}</h1>
          <p className="text-muted-foreground">
            {new Date(appointment.scheduledAt).toLocaleString()} &mdash;{" "}
            {appointment.doctor.user.name}
          </p>
        </div>
        <Badge variant="outline">{appointment.status}</Badge>
      </div>

      {appointment.reason && (
        <Card>
          <CardHeader>
            <CardTitle>{t("reason")}</CardTitle>
          </CardHeader>
          <CardContent>{appointment.reason}</CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        {appointment.status === "REQUESTED" && (
          <form action={confirmAppointment.bind(null, appointment.id)}>
            <Button variant="secondary" type="submit">
              {t("confirm")}
            </Button>
          </form>
        )}
        {appointment.status === "CONFIRMED" && session.user.role !== "DOCTOR" && (
          <form action={checkInAppointment.bind(null, appointment.id)}>
            <Button variant="secondary" type="submit">
              {t("checkIn")}
            </Button>
          </form>
        )}
        {(appointment.status === "REQUESTED" ||
          appointment.status === "CONFIRMED" ||
          appointment.status === "CHECKED_IN") && (
          <>
            <form action={completeAppointment.bind(null, appointment.id)}>
              <Button type="submit">{t("complete")}</Button>
            </form>
            <form action={cancelAppointment.bind(null, appointment.id)}>
              <Button variant="destructive" type="submit">
                {t("cancel")}
              </Button>
            </form>
          </>
        )}
      </div>

      {(session.user.role === "ADMIN" || session.user.role === "RECEPTIONIST") &&
        (appointment.status === "CHECKED_IN" || appointment.status === "COMPLETED") && (
          <Card>
            <CardHeader>
              <CardTitle>{tBilling("title")}</CardTitle>
            </CardHeader>
            <CardContent>
              {appointment.invoice ? (
                <div className="flex items-center justify-between">
                  <span>
                    {tBilling("total")}: {Number(appointment.invoice.total).toFixed(2)}
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge variant={appointment.invoice.status === "PAID" ? "default" : "outline"}>
                      {appointment.invoice.status}
                    </Badge>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/staff/billing/${appointment.invoice.id}`}>
                        {tBilling("recordPayment")}
                      </Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <Button asChild size="sm">
                  <Link href={`/staff/billing/new?appointmentId=${appointment.id}`}>
                    {tBilling("newInvoice")}
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        )}

      {appointment.prescriptions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("writePrescription")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {appointment.prescriptions.map((rx) => (
              <div key={rx.id} className="rounded-md border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {new Date(rx.createdAt).toLocaleString()}
                  </span>
                  <Badge variant={rx.fulfilled ? "default" : "outline"}>
                    {rx.fulfilled ? "Fulfilled" : "Pending"}
                  </Badge>
                </div>
                <ul className="text-sm">
                  {rx.items.map((item) => (
                    <li key={item.id}>
                      {item.medicine.name} &mdash; {item.dosage} x{item.quantity}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {canPrescribe && (
        <Card>
          <CardHeader>
            <CardTitle>{t("writePrescription")}</CardTitle>
          </CardHeader>
          <CardContent>
            <PrescriptionForm
              action={boundCreatePrescription}
              medicines={medicines.map((m) => ({
                id: m.id,
                name: m.name,
                unit: m.unit,
              }))}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

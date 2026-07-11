import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { InvoiceForm } from "@/components/billing/invoice-form";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ appointmentId?: string }>;
}) {
  await requireRole(["ADMIN", "RECEPTIONIST"]);
  const t = await getTranslations("billing");
  const { appointmentId } = await searchParams;

  if (appointmentId) {
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { patient: true, invoice: true },
    });
    if (!appointment) notFound();
    if (appointment.invoice) {
      return (
        <div className="grid gap-4">
          <h1 className="text-2xl font-semibold">{t("newInvoice")}</h1>
          <p className="text-muted-foreground">
            This appointment already has an invoice.
          </p>
        </div>
      );
    }

    return (
      <div className="grid gap-4">
        <h1 className="text-2xl font-semibold">{t("newInvoice")}</h1>
        <InvoiceForm
          lockedPatient={{ id: appointment.patientId, name: appointment.patient.name }}
          appointmentId={appointment.id}
          redirectOnSuccess={`/staff/appointments/${appointment.id}`}
        />
      </div>
    );
  }

  const patients = await prisma.patient.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-semibold">{t("newInvoice")}</h1>
      <InvoiceForm patients={patients.map((p) => ({ id: p.id, name: p.name }))} />
    </div>
  );
}

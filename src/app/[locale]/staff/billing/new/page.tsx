import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/authz";
import { Link } from "@/i18n/navigation";
import { InvoiceForm } from "@/components/billing/invoice-form";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ appointmentId?: string }>;
}) {
  await requirePageRole(["ADMIN", "STAFF"]);
  const t = await getTranslations("billing");
  const { appointmentId } = await searchParams;

  const invoiceCount = await prisma.invoice.count();

  if (appointmentId) {
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { patient: true, doctor: true, invoice: true },
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
        <Link
          href={`/staff/appointments/${appointment.id}`}
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Back
        </Link>
        <InvoiceForm
          lockedPatient={{ id: appointment.patientId, name: appointment.patient.name }}
          appointmentId={appointment.id}
          redirectOnSuccess={`/staff/appointments/${appointment.id}`}
          defaultConsultationFee={Number(appointment.doctor.consultationFee)}
          nextInvoiceNumber={invoiceCount + 1}
        />
      </div>
    );
  }

  const patients = await prisma.patient.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="grid gap-4">
      <Link
        href="/staff/billing"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Back
      </Link>
      <InvoiceForm
        patients={patients.map((p) => ({ id: p.id, name: p.name }))}
        nextInvoiceNumber={invoiceCount + 1}
      />
    </div>
  );
}

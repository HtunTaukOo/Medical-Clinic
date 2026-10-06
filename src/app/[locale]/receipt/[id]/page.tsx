import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PrintButton } from "@/components/lab/print-button";
import { getLocale, getTranslations } from "next-intl/server";

function formatKyat(value: number) {
  return `MMK ${Math.round(value).toLocaleString()}`;
}

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const t = await getTranslations("receipt");
  const locale = await getLocale();
  if (!session?.user) notFound();
  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      patient: true,
      items: true,
      payments: true,
      appointment: { include: { doctor: { include: { user: true } } } },
    },
  });
  if (!invoice) notFound();

  const role = session.user.role;
  const isOwnPatient = role === "PATIENT" && session.user.patientId === invoice.patientId;
  const isFrontOfficeStaff = role === "ADMIN" || role === "STAFF";
  if (!isOwnPatient && !isFrontOfficeStaff) notFound();

  if (invoice.status !== "PAID") notFound();

  const lastPayment = invoice.payments[invoice.payments.length - 1];

  return (
    <div className="mx-auto max-w-2xl p-8 print:p-0">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <PrintButton />
      </div>

      <div className="mb-6 grid gap-1 border-b pb-4">
        <p className="text-lg font-semibold">{t("heading")}</p>
        <p>{t("patient", { name: invoice.patient.name })}</p>
        {invoice.appointment?.doctor && <p>{t("doctor", { name: invoice.appointment.doctor.user.name })}</p>}
        <p>{t("invoiceDate", { date: invoice.createdAt.toLocaleDateString(locale === "my" ? "my-MM" : "en-US") })}</p>
        {lastPayment && (
          <p>
            {t("paid", { date: lastPayment.paidAt.toLocaleDateString(locale === "my" ? "my-MM" : "en-US"), method: lastPayment.method.replace("_", " ") })}
          </p>
        )}
      </div>

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2 pr-4">{t("description")}</th><th className="py-2 pr-4">{t("quantity")}</th><th className="py-2">{t("amount")}</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item) => (
            <tr key={item.id} className="border-b">
              <td className="py-2 pr-4">{item.description}</td>
              <td className="py-2 pr-4">{item.quantity}</td>
              <td className="py-2">{formatKyat(item.quantity * Number(item.unitPrice))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-4 text-right text-lg font-semibold">
        {t("totalPaid", { amount: formatKyat(Number(invoice.total)) })}
      </p>
    </div>
  );
}

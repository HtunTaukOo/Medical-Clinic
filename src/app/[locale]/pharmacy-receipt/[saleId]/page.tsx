import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { rxCode } from "@/lib/pharmacy";
import { PrintButton } from "@/components/lab/print-button";
import { getLocale, getTranslations } from "next-intl/server";

function formatKyat(value: number) {
  return `MMK ${Math.round(value).toLocaleString()}`;
}

export default async function PharmacyReceiptPage({
  params,
}: {
  params: Promise<{ saleId: string }>;
}) {
  const session = await auth();
  const t = await getTranslations("receipt");
  const locale = await getLocale();
  if (!session?.user) notFound();
  const { saleId } = await params;

  const sale = await prisma.pharmacySale.findUnique({
    where: { id: saleId },
    include: { patient: true, items: true, soldBy: true },
  });
  if (!sale) notFound();

  const role = session.user.role;
  const isOwnPatient = role === "PATIENT" && session.user.patientId === sale.patientId;
  const isFrontOfficeStaff = role === "ADMIN" || role === "STAFF";
  if (!isOwnPatient && !isFrontOfficeStaff) notFound();

  return (
    <div className="mx-auto max-w-2xl p-8 print:p-0">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <h1 className="text-xl font-semibold">{t("pharmacyTitle")}</h1>
        <PrintButton />
      </div>

      <div className="mb-6 grid gap-1 border-b pb-4">
        <p className="text-lg font-semibold">{t("pharmacyHeading")}</p>
        <p>{t("patient", { name: sale.patient.name })}</p>
        {sale.prescriptionId && <p>{t("rx", { code: rxCode(sale.prescriptionId, sale.createdAt) })}</p>}
        <p>{t("date", { date: sale.createdAt.toLocaleString(locale === "my" ? "my-MM" : "en-US") })}</p>
        <p>
          {t("payment", { method: sale.paymentMethod, name: sale.soldBy.name })}
        </p>
        {sale.status === "RETURNED" && (
          <p className="font-semibold text-destructive">{t("saleReturned")}</p>
        )}
      </div>

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2 pr-4">{t("medicine")}</th><th className="py-2 pr-4">{t("quantity")}</th><th className="py-2">{t("amount")}</th>
          </tr>
        </thead>
        <tbody>
          {sale.items.map((item) => (
            <tr key={item.id} className="border-b">
              <td className="py-2 pr-4">{item.name}</td>
              <td className="py-2 pr-4">{item.quantity}</td>
              <td className="py-2">{formatKyat(item.quantity * Number(item.unitPrice))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 grid gap-1 text-right text-sm">
        <p>{t("subtotal", { amount: formatKyat(Number(sale.subtotal)) })}</p>
        {Number(sale.discount) > 0 && <p>{t("discount", { amount: formatKyat(Number(sale.discount)) })}</p>}
        <p className="text-lg font-semibold">{t("totalPaid", { amount: formatKyat(Number(sale.total)) })}</p>
      </div>
    </div>
  );
}

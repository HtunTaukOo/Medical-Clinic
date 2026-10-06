import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PrintButton } from "@/components/lab/print-button";
import { getLocale, getTranslations } from "next-intl/server";

export default async function LabReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const t = await getTranslations("labReport");
  const locale = await getLocale();
  if (!session?.user) notFound();
  const { id } = await params;

  const order = await prisma.labOrder.findUnique({
    where: { id },
    include: {
      patient: true,
      doctor: { include: { user: true } },
      items: { include: { labTest: true } },
    },
  });
  if (!order) notFound();

  const role = session.user.role;
  const isOwnPatient = role === "PATIENT" && session.user.patientId === order.patientId;
  const isOwnDoctor = role === "DOCTOR" && session.user.doctorId === order.doctorId;
  const isFrontOfficeStaff = role === "ADMIN" || role === "STAFF";
  if (!isOwnPatient && !isOwnDoctor && !isFrontOfficeStaff) notFound();

  if (order.status !== "COMPLETED") notFound();

  return (
    <div className="mx-auto max-w-2xl p-8 print:p-0">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <PrintButton />
      </div>

      <div className="mb-6 grid gap-1 border-b pb-4">
        <p className="text-lg font-semibold">{t("heading")}</p>
        <p>{t("patient", { name: order.patient.name })}</p>
        <p>{t("doctor", { name: order.doctor.user.name })}</p>
        <p>{t("date", { date: order.completedAt?.toLocaleString(locale === "my" ? "my-MM" : "en-US") ?? "—" })}</p>
      </div>

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2 pr-4">{t("test")}</th>
            <th className="py-2 pr-4">{t("result")}</th>
            <th className="py-2">{t("normalRange")}</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id} className="border-b">
              <td className="py-2 pr-4">{item.labTest.name}</td>
              <td className="py-2 pr-4">
                {item.resultValue ?? "—"} {item.labTest.unit}
              </td>
              <td className="py-2">{item.labTest.normalRange ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {order.items.some((item) => item.resultNote) && (
        <div className="mt-4 grid gap-1 text-sm text-muted-foreground">
          {order.items
            .filter((item) => item.resultNote)
            .map((item) => (
              <p key={item.id}>
                {item.labTest.name}: {item.resultNote}
              </p>
            ))}
        </div>
      )}
    </div>
  );
}

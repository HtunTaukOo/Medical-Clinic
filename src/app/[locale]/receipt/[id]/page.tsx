import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PrintButton } from "@/components/lab/print-button";

function formatKyat(value: number) {
  return `K ${Math.round(value).toLocaleString()}`;
}

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
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
  const isFrontOfficeStaff = role === "ADMIN" || role === "RECEPTIONIST";
  if (!isOwnPatient && !isFrontOfficeStaff) notFound();

  if (invoice.status !== "PAID") notFound();

  const lastPayment = invoice.payments[invoice.payments.length - 1];

  return (
    <div className="mx-auto max-w-2xl p-8 print:p-0">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <h1 className="text-xl font-semibold">Receipt</h1>
        <PrintButton />
      </div>

      <div className="mb-6 grid gap-1 border-b pb-4">
        <p className="text-lg font-semibold">NCA Clinic — Payment Receipt</p>
        <p>Patient: {invoice.patient.name}</p>
        {invoice.appointment?.doctor && <p>Doctor: {invoice.appointment.doctor.user.name}</p>}
        <p>Invoice date: {invoice.createdAt.toLocaleDateString()}</p>
        {lastPayment && (
          <p>
            Paid: {lastPayment.paidAt.toLocaleDateString()} ({lastPayment.method.replace("_", " ")})
          </p>
        )}
      </div>

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2 pr-4">Description</th>
            <th className="py-2 pr-4">Qty</th>
            <th className="py-2">Amount</th>
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
        Total paid: {formatKyat(Number(invoice.total))}
      </p>
    </div>
  );
}

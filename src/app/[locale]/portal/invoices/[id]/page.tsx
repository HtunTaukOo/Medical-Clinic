import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function PortalInvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const { id } = await params;
  const t = await getTranslations("billing");

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      items: true,
      payments: { include: { refunds: true } },
      claims: { orderBy: { submittedAt: "desc" } },
    },
  });

  if (!invoice || invoice.patientId !== session?.user.patientId) notFound();

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("invoices")}</h1>
        <Badge variant={invoice.status === "PAID" ? "success" : "outline"}>
          {invoice.status}
        </Badge>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("description")}</TableHead>
            <TableHead>{t("quantity")}</TableHead>
            <TableHead>{t("unitPrice")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoice.items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>{item.description}</TableCell>
              <TableCell>{item.quantity}</TableCell>
              <TableCell>{Number(item.unitPrice).toFixed(2)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="text-lg font-semibold">
        {t("total")}: {Number(invoice.total).toFixed(2)}
      </p>

      {invoice.payments.length > 0 && (
        <div className="grid gap-2">
          <h2 className="font-semibold">{t("recordPayment")}</h2>
          {invoice.payments.map((payment) => (
            <div key={payment.id} className="grid gap-1 text-sm">
              <div className="flex items-center justify-between">
                <span>{new Date(payment.paidAt).toLocaleDateString()}</span>
                <span>{payment.method}</span>
                <span>{Number(payment.amount).toFixed(2)}</span>
              </div>
              {payment.refunds.map((refund) => (
                <p key={refund.id} className="text-muted-foreground">
                  {t("refunded")}: {Number(refund.amount).toFixed(2)}
                  {refund.reason ? ` — ${refund.reason}` : ""}
                </p>
              ))}
            </div>
          ))}
        </div>
      )}

      {invoice.claims.length > 0 && (
        <div className="grid gap-2">
          <h2 className="font-semibold">{t("insuranceClaims")}</h2>
          {invoice.claims.map((claim) => (
            <div key={claim.id} className="flex items-center justify-between text-sm">
              <span>
                {claim.insuranceProvider} &mdash; {Number(claim.claimedAmount).toFixed(2)}
              </span>
              <Badge variant={claim.status === "PAID" ? "success" : "outline"}>
                {claim.status}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

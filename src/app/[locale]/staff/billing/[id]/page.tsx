import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { recordPayment, removeInvoiceItem, voidPayment } from "@/actions/billing";
import { PaymentForm } from "@/components/billing/payment-form";
import { AddInvoiceItemForm } from "@/components/billing/add-invoice-item-form";
import { RefundForm } from "@/components/billing/refund-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireRole(["ADMIN", "RECEPTIONIST"]);
  const { id } = await params;
  const t = await getTranslations("billing");

  const [invoice, packages] = await Promise.all([
    prisma.invoice.findUnique({
      where: { id },
      include: {
        patient: true,
        items: true,
        payments: { orderBy: { paidAt: "desc" }, include: { refunds: true } },
      },
    }),
    prisma.package.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  if (!invoice) notFound();

  const boundRecordPayment = recordPayment.bind(null, invoice.id);

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{invoice.patient.name}</h1>
        <Badge variant={invoice.status === "PAID" ? "default" : "outline"}>
          {invoice.status}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("invoices")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("description")}</TableHead>
                <TableHead>{t("quantity")}</TableHead>
                <TableHead>{t("unitPrice")}</TableHead>
                {invoice.status !== "PAID" && <TableHead className="text-right" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.description}</TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell>{Number(item.unitPrice).toFixed(2)}</TableCell>
                  {invoice.status !== "PAID" && (
                    <TableCell className="text-right">
                      {invoice.items.length > 1 && (
                        <form action={removeInvoiceItem.bind(null, invoice.id, item.id)}>
                          <Button size="sm" variant="ghost" type="submit">
                            <Trash2 className="size-4" />
                          </Button>
                        </form>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="mt-4 text-lg font-semibold">
            {t("total")}: {Number(invoice.total).toFixed(2)}
          </p>
          {invoice.status !== "PAID" && (
            <div className="mt-4">
              <AddInvoiceItemForm
                invoiceId={invoice.id}
                packages={packages.map((p) => ({ id: p.id, name: p.name, price: Number(p.price) }))}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("recordPayment")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {invoice.payments.map((payment) => {
            const refundedTotal = payment.refunds.reduce(
              (sum, r) => sum + Number(r.amount),
              0
            );
            const refundable = Number(payment.amount) - refundedTotal;
            return (
              <div key={payment.id} className="grid gap-2 border-b pb-3 last:border-b-0">
                <div className="flex items-center justify-between text-sm">
                  <span>{new Date(payment.paidAt).toLocaleString()}</span>
                  <span>{payment.method}</span>
                  <span>{Number(payment.amount).toFixed(2)}</span>
                  {session.user.role === "ADMIN" && (
                    <form action={voidPayment.bind(null, invoice.id, payment.id)}>
                      <Button size="sm" variant="ghost" type="submit">
                        {t("void")}
                      </Button>
                    </form>
                  )}
                </div>
                {payment.refunds.map((refund) => (
                  <p key={refund.id} className="text-sm text-muted-foreground">
                    {t("refunded")}: {Number(refund.amount).toFixed(2)}
                    {refund.reason ? ` — ${refund.reason}` : ""} (
                    {new Date(refund.createdAt).toLocaleDateString()})
                  </p>
                ))}
                {session.user.role === "ADMIN" && refundable > 0 && (
                  <RefundForm
                    invoiceId={invoice.id}
                    paymentId={payment.id}
                    maxAmount={refundable}
                  />
                )}
              </div>
            );
          })}
          {invoice.status !== "PAID" && <PaymentForm action={boundRecordPayment} />}
        </CardContent>
      </Card>
    </div>
  );
}

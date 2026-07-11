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
    include: { items: true, payments: true },
  });

  if (!invoice || invoice.patientId !== session?.user.patientId) notFound();

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("invoices")}</h1>
        <Badge variant={invoice.status === "PAID" ? "default" : "outline"}>
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
    </div>
  );
}

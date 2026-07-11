import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function BillingPage() {
  await requireRole(["ADMIN", "RECEPTIONIST"]);
  const t = await getTranslations("billing");

  const invoices = await prisma.invoice.findMany({
    orderBy: { createdAt: "desc" },
    include: { patient: true },
  });

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <Button asChild>
          <Link href="/staff/billing/new">{t("newInvoice")}</Link>
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("patient")}</TableHead>
            <TableHead>{t("total")}</TableHead>
            <TableHead>{t("status")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.length === 0 && (
            <TableRow>
              <TableCell colSpan={3} className="text-muted-foreground">
                {t("noResults")}
              </TableCell>
            </TableRow>
          )}
          {invoices.map((invoice) => (
            <TableRow key={invoice.id}>
              <TableCell>
                <Link href={`/staff/billing/${invoice.id}`} className="underline">
                  {invoice.patient.name}
                </Link>
              </TableCell>
              <TableCell>{Number(invoice.total).toFixed(2)}</TableCell>
              <TableCell>
                <Badge variant={invoice.status === "PAID" ? "default" : "outline"}>
                  {invoice.status}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

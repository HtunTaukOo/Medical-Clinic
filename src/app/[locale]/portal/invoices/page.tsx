import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function PortalInvoicesPage() {
  const session = await auth();
  const t = await getTranslations("billing");
  const patientId = session?.user.patientId;

  const invoices = patientId
    ? await prisma.invoice.findMany({
        where: { patientId },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-semibold">{t("invoices")}</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("total")}</TableHead>
            <TableHead>{t("status")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.length === 0 && (
            <TableRow>
              <TableCell colSpan={2} className="text-muted-foreground">
                {t("noResults")}
              </TableCell>
            </TableRow>
          )}
          {invoices.map((invoice) => (
            <TableRow key={invoice.id}>
              <TableCell>
                <Link href={`/portal/invoices/${invoice.id}`} className="underline">
                  {Number(invoice.total).toFixed(2)}
                </Link>
              </TableCell>
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

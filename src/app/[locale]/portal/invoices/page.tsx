import { Receipt } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";

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

      {invoices.length === 0 ? (
        <EmptyState icon={Receipt} message={t("noResults")} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {invoices.map((invoice) => (
            <Link key={invoice.id} href={`/portal/invoices/${invoice.id}`}>
              <Card className="h-full transition-colors hover:bg-muted/50">
                <CardContent className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex size-11 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                      <Receipt className="size-5" />
                    </div>
                    <p className="font-semibold">
                      {t("total")}: {Number(invoice.total).toFixed(2)}
                    </p>
                  </div>
                  <Badge variant={invoice.status === "PAID" ? "default" : "outline"}>
                    {invoice.status}
                  </Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

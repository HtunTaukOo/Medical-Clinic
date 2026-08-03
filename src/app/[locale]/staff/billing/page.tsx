import { Receipt } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/authz";
import { initials } from "@/lib/format";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { EmptyState } from "@/components/empty-state";

export default async function BillingPage() {
  await requirePageRole(["ADMIN", "RECEPTIONIST"]);
  const t = await getTranslations("billing");

  const invoices = await prisma.invoice.findMany({
    orderBy: { createdAt: "desc" },
    include: { patient: true },
  });

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/staff/billing/claims">{t("insuranceClaims")}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/staff/billing/packages">{t("packages")}</Link>
          </Button>
          <Button asChild>
            <Link href="/staff/billing/new">{t("newInvoice")}</Link>
          </Button>
        </div>
      </div>

      {invoices.length === 0 ? (
        <EmptyState icon={Receipt} message={t("noResults")} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {invoices.map((invoice) => (
            <Link key={invoice.id} href={`/staff/billing/${invoice.id}`}>
              <Card className="h-full transition-colors hover:bg-muted/50">
                <CardContent className="grid gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <Avatar className="size-12">
                        <AvatarFallback className="bg-secondary text-secondary-foreground">
                          {initials(invoice.patient.name)}
                        </AvatarFallback>
                      </Avatar>
                      <p className="font-semibold">{invoice.patient.name}</p>
                    </div>
                    <Badge variant={invoice.status === "PAID" ? "default" : "outline"}>
                      {invoice.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Receipt className="size-4" />
                    {t("total")}: {Number(invoice.total).toFixed(2)}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

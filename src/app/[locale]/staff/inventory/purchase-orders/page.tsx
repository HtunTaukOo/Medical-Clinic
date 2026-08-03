import { ClipboardList } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/authz";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";

const STATUS_VARIANT: Record<string, "default" | "outline" | "destructive"> = {
  DRAFT: "outline",
  ORDERED: "outline",
  PARTIALLY_RECEIVED: "outline",
  RECEIVED: "default",
  CANCELLED: "destructive",
};

export default async function PurchaseOrdersPage() {
  await requirePageRole(["ADMIN", "PHARMACIST"]);
  const t = await getTranslations("inventory");

  const orders = await prisma.purchaseOrder.findMany({
    orderBy: { createdAt: "desc" },
    include: { supplier: true, items: true },
  });

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("purchaseOrders")}</h1>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/staff/inventory/suppliers">{t("suppliers")}</Link>
          </Button>
          <Button asChild>
            <Link href="/staff/inventory/purchase-orders/new">{t("newPurchaseOrder")}</Link>
          </Button>
        </div>
      </div>

      {orders.length === 0 ? (
        <EmptyState icon={ClipboardList} message={t("noPurchaseOrders")} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {orders.map((order) => {
            const total = order.items.reduce(
              (sum, item) => sum + item.quantity * Number(item.unitCost),
              0
            );
            return (
              <Link key={order.id} href={`/staff/inventory/purchase-orders/${order.id}`}>
                <Card className="h-full transition-colors hover:bg-muted/50">
                  <CardContent className="grid gap-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold">{order.supplier.name}</p>
                      <Badge variant={STATUS_VARIANT[order.status]}>{order.status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t("total")}: {total.toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

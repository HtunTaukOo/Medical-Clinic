import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/authz";
import { markOrdered, cancelPurchaseOrder } from "@/actions/purchase-orders";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ReceiveStockForm } from "@/components/inventory/receive-stock-form";

export default async function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageRole(["ADMIN", "PHARMACIST"]);
  const { id } = await params;
  const t = await getTranslations("inventory");

  const order = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: { supplier: true, items: { include: { medicine: true } }, createdBy: true },
  });

  if (!order) notFound();

  const total = order.items.reduce(
    (sum, item) => sum + item.quantity * Number(item.unitCost),
    0
  );
  const canReceive = order.status === "ORDERED" || order.status === "PARTIALLY_RECEIVED";
  const canCancel = order.status !== "RECEIVED" && order.status !== "CANCELLED";

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{order.supplier.name}</h1>
          <p className="text-sm text-muted-foreground">
            {new Date(order.createdAt).toLocaleString()} &mdash; {order.createdBy.name}
          </p>
        </div>
        <Badge variant={order.status === "RECEIVED" ? "success" : "outline"}>
          {order.status}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("items")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("medicine")}</TableHead>
                <TableHead>{t("quantity")}</TableHead>
                <TableHead>{t("unitCost")}</TableHead>
                <TableHead>{t("received")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.medicine.name}</TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell>{Number(item.unitCost).toFixed(2)}</TableCell>
                  <TableCell>
                    {item.receivedQty} / {item.quantity}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="mt-4 text-lg font-semibold">
            {t("total")}: {total.toFixed(2)}
          </p>
          {order.notes && (
            <p className="mt-2 text-sm text-muted-foreground">{order.notes}</p>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        {order.status === "DRAFT" && (
          <form action={markOrdered.bind(null, order.id)}>
            <Button type="submit">{t("markOrdered")}</Button>
          </form>
        )}
        {canCancel && (
          <form action={cancelPurchaseOrder.bind(null, order.id)}>
            <Button type="submit" variant="destructive">
              {t("cancelOrder")}
            </Button>
          </form>
        )}
      </div>

      {canReceive && (
        <Card>
          <CardHeader>
            <CardTitle>{t("receiveStock")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ReceiveStockForm
              purchaseOrderId={order.id}
              items={order.items.map((item) => ({
                id: item.id,
                medicineName: item.medicine.name,
                remaining: item.quantity - item.receivedQty,
              }))}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

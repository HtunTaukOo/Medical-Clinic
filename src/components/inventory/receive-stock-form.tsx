"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { receiveStock, type ReceiveStockState } from "@/actions/purchase-orders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ReceiveStockForm({
  purchaseOrderId,
  items,
}: {
  purchaseOrderId: string;
  items: { id: string; medicineName: string; remaining: number }[];
}) {
  const t = useTranslations("inventory");
  const boundAction = receiveStock.bind(null, purchaseOrderId);
  const [state, formAction, pending] = useActionState<ReceiveStockState, FormData>(
    boundAction,
    {}
  );

  const pendingItems = items.filter((item) => item.remaining > 0);
  if (pendingItems.length === 0) return null;

  return (
    <form action={formAction} className="grid gap-3">
      {pendingItems.map((item) => (
        <div key={item.id} className="flex flex-wrap items-end gap-2">
          <div className="min-w-40 flex-1">
            <p className="text-sm font-medium">{item.medicineName}</p>
            <p className="text-xs text-muted-foreground">
              {t("outstanding")}: {item.remaining}
            </p>
          </div>
          <div className="grid gap-1">
            <Label className="text-xs text-muted-foreground">{t("receiveQty")}</Label>
            <Input
              name={`receive_${item.id}`}
              type="number"
              min={0}
              max={item.remaining}
              className="w-24"
              placeholder="0"
            />
          </div>
        </div>
      ))}
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" size="sm" disabled={pending} className="w-fit">
        {t("receiveStock")}
      </Button>
    </form>
  );
}

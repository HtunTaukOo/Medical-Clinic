"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { adjustStock, type AdjustStockState } from "@/actions/inventory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function AdjustStockForm({ medicineId }: { medicineId: string }) {
  const t = useTranslations("inventory");
  const boundAction = adjustStock.bind(null, medicineId);
  const [state, formAction, pending] = useActionState<
    AdjustStockState,
    FormData
  >(boundAction, {});

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <Select name="type" defaultValue="IN">
        <SelectTrigger className="w-24">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="IN">IN</SelectItem>
          <SelectItem value="OUT">OUT</SelectItem>
        </SelectContent>
      </Select>
      <Input name="quantity" type="number" min={1} required className="w-20" placeholder="Qty" />
      <Input name="reason" className="w-40" placeholder="Reason" />
      <Button type="submit" size="sm" disabled={pending}>
        {t("adjustStock")}
      </Button>
      {state.error && <span className="text-sm text-destructive">{state.error}</span>}
    </form>
  );
}

"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { createPurchaseOrder, type PurchaseOrderFormState } from "@/actions/purchase-orders";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Row = { medicineId: string; quantity: string; unitCost: string };

export function PurchaseOrderForm({
  suppliers,
  medicines,
}: {
  suppliers: { id: string; name: string }[];
  medicines: { id: string; name: string; price: number }[];
}) {
  const t = useTranslations("inventory");
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([{ medicineId: "", quantity: "1", unitCost: "0" }]);
  const [state, formAction, pending] = useActionState<PurchaseOrderFormState, FormData>(
    createPurchaseOrder,
    {}
  );

  useEffect(() => {
    if (state.success) router.push("/staff/inventory/purchase-orders");
  }, [state.success, router]);

  function updateRow(index: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function selectMedicine(index: number, medicineId: string) {
    const medicine = medicines.find((m) => m.id === medicineId);
    updateRow(index, {
      medicineId,
      unitCost: medicine ? String(medicine.price) : "0",
    });
  }

  function handleSubmit(formData: FormData) {
    formData.set("items", JSON.stringify(rows));
    return formAction(formData);
  }

  const total = rows.reduce(
    (sum, row) => sum + (Number(row.quantity) || 0) * (Number(row.unitCost) || 0),
    0
  );

  return (
    <form action={handleSubmit} className="grid max-w-2xl gap-4">
      <div className="grid gap-2">
        <Label htmlFor="supplierId">{t("supplier")}</Label>
        <Select name="supplierId" required>
          <SelectTrigger id="supplierId" className="w-full">
            <SelectValue placeholder={t("supplier")} />
          </SelectTrigger>
          <SelectContent>
            {suppliers.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3">
        {rows.map((row, index) => (
          <div key={index} className="flex flex-wrap items-end gap-2">
            <div className="grid min-w-48 flex-1 gap-1">
              <Label className="text-xs text-muted-foreground">{t("medicine")}</Label>
              <Select
                value={row.medicineId || undefined}
                onValueChange={(value) => selectMedicine(index, value)}
              >
                <SelectTrigger id={`po-medicine-${index}`} className="w-full">
                  <SelectValue placeholder={t("medicine")} />
                </SelectTrigger>
                <SelectContent>
                  {medicines.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <Label className="text-xs text-muted-foreground">{t("quantity")}</Label>
              <Input
                type="number"
                min={1}
                value={row.quantity}
                onChange={(e) => updateRow(index, { quantity: e.target.value })}
                className="w-20"
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs text-muted-foreground">{t("unitCost")}</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={row.unitCost}
                onChange={(e) => updateRow(index, { unitCost: e.target.value })}
                className="w-28"
              />
            </div>
            {rows.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
              >
                {t("remove")}
              </Button>
            )}
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={() =>
            setRows((prev) => [...prev, { medicineId: "", quantity: "1", unitCost: "0" }])
          }
        >
          {t("addItem")}
        </Button>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="po-notes">{t("notes")}</Label>
        <Textarea id="po-notes" name="notes" rows={2} />
      </div>

      <p className="text-lg font-semibold">
        {t("total")}: {total.toFixed(2)}
      </p>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending || rows.some((r) => !r.medicineId)} className="w-fit">
        {t("newPurchaseOrder")}
      </Button>
    </form>
  );
}

"use client";

import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { createMedicine, updateMedicine, type MedicineFormState } from "@/actions/inventory";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function MedicineForm({
  medicine,
}: {
  medicine?: {
    id: string;
    name: string;
    unit: string;
    reorderLevel: number;
    price: number;
  };
}) {
  const t = useTranslations("inventory");
  const router = useRouter();
  const action = medicine ? updateMedicine.bind(null, medicine.id) : createMedicine;
  const [state, formAction, pending] = useActionState<MedicineFormState, FormData>(
    action,
    {}
  );

  useEffect(() => {
    if (state.success) {
      router.push(medicine ? `/staff/inventory/${medicine.id}` : "/staff/inventory");
    }
  }, [state.success, router, medicine]);

  return (
    <form action={formAction} className="grid max-w-md gap-4">
      <div className="grid gap-2">
        <Label htmlFor="name">{t("name")}</Label>
        <Input id="name" name="name" required defaultValue={medicine?.name} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="unit">{t("unit")}</Label>
        <Input
          id="unit"
          name="unit"
          required
          placeholder="tablet, bottle, ..."
          defaultValue={medicine?.unit}
        />
      </div>
      {!medicine && (
        <div className="grid gap-2">
          <Label htmlFor="stockQty">{t("stockQty")}</Label>
          <Input id="stockQty" name="stockQty" type="number" min={0} required defaultValue={0} />
        </div>
      )}
      <div className="grid gap-2">
        <Label htmlFor="reorderLevel">{t("reorderLevel")}</Label>
        <Input
          id="reorderLevel"
          name="reorderLevel"
          type="number"
          min={0}
          required
          defaultValue={medicine?.reorderLevel ?? 10}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="price">{t("price")}</Label>
        <Input
          id="price"
          name="price"
          type="number"
          min={0}
          step="0.01"
          required
          defaultValue={medicine?.price}
        />
      </div>
      {!medicine && (
        <div className="grid gap-2">
          <Label htmlFor="expiryDate">{t("expiryDate")}</Label>
          <Input id="expiryDate" name="expiryDate" type="date" />
        </div>
      )}
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending} className="w-fit">
        {medicine ? "Save changes" : t("newMedicine")}
      </Button>
    </form>
  );
}

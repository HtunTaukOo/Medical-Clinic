"use client";

import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { createMedicine, type MedicineFormState } from "@/actions/inventory";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function MedicineForm() {
  const t = useTranslations("inventory");
  const router = useRouter();
  const [state, formAction, pending] = useActionState<
    MedicineFormState,
    FormData
  >(createMedicine, {});

  useEffect(() => {
    if (state.success) router.push("/staff/inventory");
  }, [state.success, router]);

  return (
    <form action={formAction} className="grid max-w-md gap-4">
      <div className="grid gap-2">
        <Label htmlFor="name">{t("name")}</Label>
        <Input id="name" name="name" required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="unit">{t("unit")}</Label>
        <Input id="unit" name="unit" required placeholder="tablet, bottle, ..." />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="stockQty">{t("stockQty")}</Label>
        <Input id="stockQty" name="stockQty" type="number" min={0} required defaultValue={0} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="reorderLevel">{t("reorderLevel")}</Label>
        <Input
          id="reorderLevel"
          name="reorderLevel"
          type="number"
          min={0}
          required
          defaultValue={10}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="price">{t("price")}</Label>
        <Input id="price" name="price" type="number" min={0} step="0.01" required />
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending} className="w-fit">
        {t("newMedicine")}
      </Button>
    </form>
  );
}

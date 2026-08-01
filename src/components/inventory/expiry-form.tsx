"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { setMedicineExpiry, type SetExpiryState } from "@/actions/inventory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ExpiryForm({
  medicineId,
  currentExpiryDate,
}: {
  medicineId: string;
  currentExpiryDate: string | null;
}) {
  const t = useTranslations("inventory");
  const boundAction = setMedicineExpiry.bind(null, medicineId);
  const [state, formAction, pending] = useActionState<SetExpiryState, FormData>(
    boundAction,
    {}
  );

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <Input
        name="expiryDate"
        type="date"
        defaultValue={currentExpiryDate ?? ""}
        className="w-40"
      />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {t("setExpiry")}
      </Button>
      {state.error && <span className="text-sm text-destructive">{state.error}</span>}
    </form>
  );
}

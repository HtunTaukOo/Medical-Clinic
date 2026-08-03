"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { createSupplier, type SupplierFormState } from "@/actions/suppliers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SupplierForm() {
  const t = useTranslations("inventory");
  const [state, formAction, pending] = useActionState<SupplierFormState, FormData>(
    createSupplier,
    {}
  );

  return (
    <form action={formAction} key={state.success ? "reset" : "form"} className="grid max-w-md gap-4">
      <div className="grid gap-2">
        <Label htmlFor="supplier-name">{t("supplierName")}</Label>
        <Input id="supplier-name" name="name" required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="supplier-contact">{t("supplierContact")}</Label>
        <Input id="supplier-contact" name="contactName" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="supplier-phone">{t("supplierPhone")}</Label>
          <Input id="supplier-phone" name="phone" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="supplier-email">{t("supplierEmail")}</Label>
          <Input id="supplier-email" name="email" type="email" />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="supplier-address">{t("supplierAddress")}</Label>
        <Input id="supplier-address" name="address" />
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending} className="w-fit">
        {t("newSupplier")}
      </Button>
    </form>
  );
}

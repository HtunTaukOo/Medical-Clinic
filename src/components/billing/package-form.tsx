"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { createPackage, type PackageFormState } from "@/actions/packages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function PackageForm() {
  const t = useTranslations("billing");
  const [state, formAction, pending] = useActionState<PackageFormState, FormData>(
    createPackage,
    {}
  );

  return (
    <form action={formAction} key={state.success ? "reset" : "form"} className="grid max-w-md gap-4">
      <div className="grid gap-2">
        <Label htmlFor="package-name">{t("packageName")}</Label>
        <Input id="package-name" name="name" required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="package-description">{t("packageDescription")}</Label>
        <Textarea id="package-description" name="description" rows={2} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="package-price">{t("price")}</Label>
        <Input id="package-price" name="price" type="number" min={0} step="0.01" required />
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending} className="w-fit">
        {t("newPackage")}
      </Button>
    </form>
  );
}

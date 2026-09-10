"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { createPackage, updatePackage, type PackageFormState } from "@/actions/packages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function PackageForm({
  pkg,
}: {
  pkg?: { id: string; name: string; description: string | null; price: number };
}) {
  const t = useTranslations("billing");
  const action = pkg ? updatePackage.bind(null, pkg.id) : createPackage;
  const [state, formAction, pending] = useActionState<PackageFormState, FormData>(action, {});

  return (
    <form
      action={formAction}
      key={!pkg && state.success ? "reset" : "form"}
      className="grid max-w-md gap-4"
    >
      <div className="grid gap-2">
        <Label htmlFor={`package-name-${pkg?.id ?? "new"}`}>{t("packageName")}</Label>
        <Input id={`package-name-${pkg?.id ?? "new"}`} name="name" defaultValue={pkg?.name} required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`package-description-${pkg?.id ?? "new"}`}>{t("packageDescription")}</Label>
        <Textarea
          id={`package-description-${pkg?.id ?? "new"}`}
          name="description"
          rows={2}
          defaultValue={pkg?.description ?? ""}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`package-price-${pkg?.id ?? "new"}`}>{t("price")}</Label>
        <Input
          id={`package-price-${pkg?.id ?? "new"}`}
          name="price"
          type="number"
          min={0}
          step="0.01"
          defaultValue={pkg?.price}
          required
        />
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {pkg && state.success && <p className="text-sm text-primary">Saved.</p>}
      <Button type="submit" disabled={pending} className="w-fit">
        {pkg ? "Save Changes" : t("newPackage")}
      </Button>
    </form>
  );
}

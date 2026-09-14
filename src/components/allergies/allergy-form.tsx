"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import type { AllergyFormState } from "@/actions/allergies";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function AllergyForm({
  action,
}: {
  action: (state: AllergyFormState, formData: FormData) => Promise<AllergyFormState>;
}) {
  const t = useTranslations("portal.allergies");
  const [state, formAction, pending] = useActionState<AllergyFormState, FormData>(
    action,
    {}
  );

  return (
    <form
      action={formAction}
      key={state.success ? "reset" : "form"}
      className="grid gap-3 sm:grid-cols-2"
    >
      <div className="grid gap-1.5">
        <Label htmlFor="allergy-name">{t("allergen")}</Label>
        <Input id="allergy-name" name="name" required placeholder={t("allergenPlaceholder")} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="allergy-category">{t("category")}</Label>
        <Select name="category" defaultValue="OTHER">
          <SelectTrigger id="allergy-category" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="DRUG">{t("categoryDrug")}</SelectItem>
            <SelectItem value="FOOD">{t("categoryFood")}</SelectItem>
            <SelectItem value="ENVIRONMENTAL">{t("categoryEnvironmental")}</SelectItem>
            <SelectItem value="OTHER">{t("categoryOther")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="allergy-reaction">{t("reactionOptional")}</Label>
        <Input id="allergy-reaction" name="reaction" placeholder={t("reactionPlaceholder")} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="allergy-severity">{t("severity")}</Label>
        <Select name="severity" defaultValue="MILD">
          <SelectTrigger id="allergy-severity" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="MILD">{t("severityMild")}</SelectItem>
            <SelectItem value="MODERATE">{t("severityModerate")}</SelectItem>
            <SelectItem value="SEVERE">{t("severitySevere")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="allergy-first-noted">{t("firstNotedOptional")}</Label>
        <Input id="allergy-first-noted" name="firstNoted" type="date" />
      </div>
      {state.error && <p className="text-sm text-destructive sm:col-span-2">{state.error}</p>}
      <Button type="submit" disabled={pending} className="w-fit sm:col-span-2">
        {t("add")}
      </Button>
    </form>
  );
}

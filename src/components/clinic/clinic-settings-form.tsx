"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import {
  updateClinicSettings,
  type ClinicSettingsFormState,
} from "@/actions/clinic-settings";
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

export function ClinicSettingsForm({
  isOpen,
  openingTime,
  closingTime,
}: {
  isOpen: boolean;
  openingTime: string;
  closingTime: string;
}) {
  const t = useTranslations("clinic");
  const [state, formAction, pending] = useActionState<
    ClinicSettingsFormState,
    FormData
  >(updateClinicSettings, {});

  return (
    <form action={formAction} className="grid max-w-sm gap-4">
      <div className="grid gap-2">
        <Label htmlFor="isOpen">{t("isOpen")}</Label>
        <Select name="isOpen" defaultValue={isOpen ? "open" : "closed"}>
          <SelectTrigger id="isOpen" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">{t("open")}</SelectItem>
            <SelectItem value="closed">{t("closed")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="openingTime">{t("openingTime")}</Label>
        <Input
          id="openingTime"
          name="openingTime"
          type="time"
          defaultValue={openingTime}
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="closingTime">{t("closingTime")}</Label>
        <Input
          id="closingTime"
          name="closingTime"
          type="time"
          defaultValue={closingTime}
          required
        />
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && (
        <p className="text-sm text-muted-foreground">Saved.</p>
      )}
      <Button type="submit" disabled={pending} className="w-fit">
        {t("save")}
      </Button>
    </form>
  );
}

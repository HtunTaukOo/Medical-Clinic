"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { updateClinicNotifications, type ClinicSettingsFormState } from "@/actions/clinic-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ClinicNotificationsForm({
  staffTelegramChatId,
}: {
  staffTelegramChatId: string | null;
}) {
  const t = useTranslations("clinic");
  const [state, formAction, pending] = useActionState<ClinicSettingsFormState, FormData>(
    updateClinicNotifications,
    {}
  );

  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="staffTelegramChatId">{t("staffTelegramChatId")}</Label>
        <Input
          id="staffTelegramChatId"
          name="staffTelegramChatId"
          placeholder={t("telegramPlaceholder")}
          defaultValue={staffTelegramChatId ?? ""}
        />
        <p className="text-xs text-muted-foreground">
          {t("telegramHelp")}
        </p>
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && <p className="text-sm text-primary">{t("saved")}</p>}
      <Button type="submit" disabled={pending} className="w-fit">
        {t("saveChanges")}
      </Button>
    </form>
  );
}

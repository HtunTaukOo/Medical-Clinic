"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { adminSetPassword, type SetPasswordFormState } from "@/actions/staff";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SetPasswordForm({ userId }: { userId: string }) {
  const t = useTranslations("staff");
  const boundAction = adminSetPassword.bind(null, userId);
  const [state, formAction, pending] = useActionState<SetPasswordFormState, FormData>(
    boundAction,
    {}
  );

  return (
    <form action={formAction} className="flex items-center gap-2">
      <Input
        name="password"
        type="password"
        minLength={8}
        placeholder={t("newPassword")}
        className="w-36"
      />
      <Button size="sm" variant="outline" type="submit" disabled={pending}>
        {t("setPassword")}
      </Button>
      {state.success && <span className="text-sm text-muted-foreground">{t("saved")}</span>}
      {state.error && <span className="text-sm text-destructive">{state.error}</span>}
    </form>
  );
}

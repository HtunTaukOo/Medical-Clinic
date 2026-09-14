"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { changeOwnPassword, type ChangePasswordState } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ChangePasswordForm() {
  const t = useTranslations("portal.security");
  const [state, formAction, pending] = useActionState<ChangePasswordState, FormData>(
    changeOwnPassword,
    {}
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="grid gap-4">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {t("changePassword")}
      </p>
      <div className="grid gap-1.5">
        <Label htmlFor="currentPassword">{t("currentPassword")}</Label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          required
          placeholder={t("currentPasswordPlaceholder")}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="newPassword">{t("newPassword")}</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          required
          minLength={8}
          placeholder={t("newPasswordPlaceholder")}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="confirmPassword">{t("confirmNewPassword")}</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          placeholder={t("confirmPasswordPlaceholder")}
        />
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && <p className="text-sm text-blue-600">{t("updated")}</p>}
      <Button type="submit" disabled={pending} className="w-fit">
        {t("update")}
      </Button>
    </form>
  );
}

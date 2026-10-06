"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { requestPasswordReset, type RequestResetState } from "@/actions/auth";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const [state, formAction, pending] = useActionState<RequestResetState, FormData>(
    requestPasswordReset,
    {}
  );

  if (state.success) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("resetEmailSent")}
      </p>
    );
  }

  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="email">{t("email")}</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {t("sendResetLink")}
      </Button>
      <p className="text-sm text-muted-foreground">
        <Link href="/login" className="underline">
          {t("back")}
        </Link>
      </p>
    </form>
  );
}

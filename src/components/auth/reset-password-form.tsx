"use client";

import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { resetPassword, type ResetPasswordState } from "@/actions/auth";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [state, formAction, pending] = useActionState<ResetPasswordState, FormData>(
    resetPassword,
    {}
  );

  useEffect(() => {
    if (state.success) {
      const timeout = setTimeout(() => router.push("/login"), 1500);
      return () => clearTimeout(timeout);
    }
  }, [state.success, router]);

  if (state.success) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("passwordResetSuccess")}
      </p>
    );
  }

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="token" value={token} />
      <div className="grid gap-2">
        <Label htmlFor="password">{t("newPassword")}</Label>
        <Input id="password" name="password" type="password" required minLength={8} />
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending} className="w-full">
        {t("resetPassword")}
      </Button>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { registerPatient, type RegisterState } from "@/actions/auth";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RegisterForm() {
  const t = useTranslations("auth");
  const [state, formAction, pending] = useActionState<RegisterState, FormData>(
    registerPatient,
    {}
  );

  if (state.success) {
    return (
      <p className="text-sm text-muted-foreground">{t("registerSuccess")}</p>
    );
  }

  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="name">{t("name")}</Label>
        <Input id="name" name="name" required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="email">{t("email")}</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="phone">{t("phone")}</Label>
        <Input id="phone" name="phone" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">{t("password")}</Label>
        <Input id="password" name="password" type="password" required minLength={8} />
      </div>
      {state.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {t("register")}
      </Button>
      <p className="text-sm text-muted-foreground">
        {t("haveAccount")}{" "}
        <Link href="/login" className="underline">
          {t("login")}
        </Link>
      </p>
    </form>
  );
}

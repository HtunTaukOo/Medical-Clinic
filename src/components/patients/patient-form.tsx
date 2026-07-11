"use client";

import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import type { PatientFormState } from "@/actions/patients";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function PatientForm({
  action,
  defaultValues,
  redirectOnSuccess,
}: {
  action: (
    state: PatientFormState,
    formData: FormData
  ) => Promise<PatientFormState>;
  defaultValues?: {
    name: string;
    email: string;
    phone: string;
    dob: string;
    address: string;
    notes: string;
  };
  redirectOnSuccess?: string;
}) {
  const t = useTranslations("patients");
  const router = useRouter();
  const [state, formAction, pending] = useActionState<
    PatientFormState,
    FormData
  >(action, {});

  useEffect(() => {
    if (state.success && redirectOnSuccess) {
      router.push(redirectOnSuccess);
    }
  }, [state.success, redirectOnSuccess, router]);

  return (
    <form action={formAction} className="grid gap-4 max-w-lg">
      <div className="grid gap-2">
        <Label htmlFor="name">{t("name")}</Label>
        <Input id="name" name="name" required defaultValue={defaultValues?.name} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="email">{t("email")}</Label>
        <Input id="email" name="email" type="email" defaultValue={defaultValues?.email} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="phone">{t("phone")}</Label>
        <Input id="phone" name="phone" defaultValue={defaultValues?.phone} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="dob">{t("dob")}</Label>
        <Input id="dob" name="dob" type="date" defaultValue={defaultValues?.dob} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="address">{t("address")}</Label>
        <Input id="address" name="address" defaultValue={defaultValues?.address} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="notes">{t("notes")}</Label>
        <Textarea id="notes" name="notes" defaultValue={defaultValues?.notes} />
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && (
        <p className="text-sm text-muted-foreground">Saved.</p>
      )}
      <Button type="submit" disabled={pending}>
        {t("save")}
      </Button>
    </form>
  );
}

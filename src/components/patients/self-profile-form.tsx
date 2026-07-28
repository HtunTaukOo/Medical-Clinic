"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { updateOwnProfile, type PatientFormState } from "@/actions/patients";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SelfProfileForm({
  defaultValues,
}: {
  defaultValues: {
    name: string;
    email: string;
    phone: string;
    dob: string;
    address: string;
  };
}) {
  const t = useTranslations("patients");
  const [state, formAction, pending] = useActionState<PatientFormState, FormData>(
    updateOwnProfile,
    {}
  );

  return (
    <form action={formAction} className="grid max-w-lg gap-4">
      <div className="grid gap-2">
        <Label htmlFor="name">{t("name")}</Label>
        <Input id="name" name="name" required defaultValue={defaultValues.name} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="email">{t("email")}</Label>
        <Input id="email" name="email" type="email" defaultValue={defaultValues.email} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="phone">{t("phone")}</Label>
        <Input id="phone" name="phone" defaultValue={defaultValues.phone} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="dob">{t("dob")}</Label>
        <Input id="dob" name="dob" type="date" defaultValue={defaultValues.dob} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="address">{t("address")}</Label>
        <Input id="address" name="address" defaultValue={defaultValues.address} />
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && <p className="text-sm text-muted-foreground">Saved.</p>}
      <Button type="submit" disabled={pending} className="w-fit">
        Save changes
      </Button>
    </form>
  );
}

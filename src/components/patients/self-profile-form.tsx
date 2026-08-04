"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { updateOwnProfile, type PatientFormState } from "@/actions/patients";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function SelfProfileForm({
  defaultValues,
}: {
  defaultValues: {
    name: string;
    gender: string;
    email: string;
    phone: string;
    dob: string;
    address: string;
    allergies: string;
    insuranceProvider: string;
    insurancePolicyNumber: string;
    emergencyContactName: string;
    emergencyContactPhone: string;
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
        <Label htmlFor="gender">{t("gender")}</Label>
        <Select name="gender" defaultValue={defaultValues.gender || "UNSPECIFIED"}>
          <SelectTrigger id="gender" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="UNSPECIFIED">{t("genderUnspecified")}</SelectItem>
            <SelectItem value="MALE">{t("genderMale")}</SelectItem>
            <SelectItem value="FEMALE">{t("genderFemale")}</SelectItem>
            <SelectItem value="OTHER">{t("genderOther")}</SelectItem>
          </SelectContent>
        </Select>
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
      <div className="grid gap-2">
        <Label htmlFor="allergies">{t("allergies")}</Label>
        <Textarea id="allergies" name="allergies" defaultValue={defaultValues.allergies} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="insuranceProvider">{t("insuranceProvider")}</Label>
          <Input
            id="insuranceProvider"
            name="insuranceProvider"
            defaultValue={defaultValues.insuranceProvider}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="insurancePolicyNumber">{t("insurancePolicyNumber")}</Label>
          <Input
            id="insurancePolicyNumber"
            name="insurancePolicyNumber"
            defaultValue={defaultValues.insurancePolicyNumber}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="emergencyContactName">{t("emergencyContactName")}</Label>
          <Input
            id="emergencyContactName"
            name="emergencyContactName"
            defaultValue={defaultValues.emergencyContactName}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="emergencyContactPhone">{t("emergencyContactPhone")}</Label>
          <Input
            id="emergencyContactPhone"
            name="emergencyContactPhone"
            defaultValue={defaultValues.emergencyContactPhone}
          />
        </div>
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && <p className="text-sm text-muted-foreground">Saved.</p>}
      <Button type="submit" disabled={pending} className="w-fit">
        Save changes
      </Button>
    </form>
  );
}

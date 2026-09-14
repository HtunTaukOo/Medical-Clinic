"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { updatePersonalDetails, type PatientFormState } from "@/actions/patients";
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

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export function PersonalDetailsForm({
  defaultValues,
}: {
  defaultValues: {
    name: string;
    gender: string;
    email: string;
    phone: string;
    dob: string;
    address: string;
    bloodType: string;
    nationality: string;
    nrcNumber: string;
    heightCm: string;
    weightKg: string;
  };
}) {
  const t = useTranslations("portal.personalDetails");
  const [state, formAction, pending] = useActionState<PatientFormState, FormData>(
    updatePersonalDetails,
    {}
  );
  const [heightCm, setHeightCm] = useState(defaultValues.heightCm);
  const [weightKg, setWeightKg] = useState(defaultValues.weightKg);

  const h = Number(heightCm);
  const w = Number(weightKg);
  const bmi = h > 0 && w > 0 ? (w / (h / 100) ** 2).toFixed(1) : null;

  return (
    <form action={formAction} className="grid gap-4">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {t("personalInfo")}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="name">{t("fullName")}</Label>
          <Input id="name" name="name" required defaultValue={defaultValues.name} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="dob">{t("dob")}</Label>
          <Input id="dob" name="dob" type="date" defaultValue={defaultValues.dob} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="gender">{t("gender")}</Label>
          <Select name="gender" defaultValue={defaultValues.gender || "UNSPECIFIED"}>
            <SelectTrigger id="gender" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="UNSPECIFIED">{t("notSpecified")}</SelectItem>
              <SelectItem value="MALE">{t("male")}</SelectItem>
              <SelectItem value="FEMALE">{t("female")}</SelectItem>
              <SelectItem value="OTHER">{t("other")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="bloodType">{t("bloodType")}</Label>
          <Select name="bloodType" defaultValue={defaultValues.bloodType || "UNSPECIFIED"}>
            <SelectTrigger id="bloodType" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="UNSPECIFIED">{t("notSpecified")}</SelectItem>
              {BLOOD_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="phone">{t("phone")}</Label>
          <Input id="phone" name="phone" defaultValue={defaultValues.phone} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="email">{t("email")}</Label>
          <Input id="email" name="email" type="email" defaultValue={defaultValues.email} />
        </div>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="address">{t("address")}</Label>
          <Input id="address" name="address" defaultValue={defaultValues.address} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="nationality">{t("nationality")}</Label>
          <Input id="nationality" name="nationality" defaultValue={defaultValues.nationality} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="nrcNumber">{t("nrcNumber")}</Label>
          <Input id="nrcNumber" name="nrcNumber" defaultValue={defaultValues.nrcNumber} />
        </div>
      </div>

      <p className="mt-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {t("healthBasics")}
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="heightCm">{t("heightCm")}</Label>
          <Input
            id="heightCm"
            name="heightCm"
            type="number"
            step="0.1"
            value={heightCm}
            onChange={(e) => setHeightCm(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="weightKg">{t("weightKg")}</Label>
          <Input
            id="weightKg"
            name="weightKg"
            type="number"
            step="0.1"
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="bmi">{t("bmi")}</Label>
          <Input id="bmi" value={bmi ?? ""} placeholder="—" disabled />
          <p className="text-xs text-muted-foreground">{t("autoCalculated")}</p>
        </div>
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && <p className="text-sm text-muted-foreground">{t("saved")}</p>}
      <Button type="submit" disabled={pending} className="w-fit">
        {t("save")}
      </Button>
    </form>
  );
}

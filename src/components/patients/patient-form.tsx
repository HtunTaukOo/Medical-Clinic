"use client";

import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import type { PatientFormState } from "@/actions/patients";
import { useRouter } from "@/i18n/navigation";
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
    gender: string;
    email: string;
    phone: string;
    dob: string;
    address: string;
    notes: string;
    bloodType: string;
    nationality: string;
    nrcNumber: string;
    heightCm: string;
    weightKg: string;
    insuranceProvider: string;
    insurancePolicyNumber: string;
    insuranceGroupNumber: string;
    insuranceCoverageType: string;
    insurancePolicyHolder: string;
    insuranceExpiryDate: string;
    emergencyContactName: string;
    emergencyContactRelationship: string;
    emergencyContactPhone: string;
    emergencyContactAltPhone: string;
    emergencyContactAddress: string;
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
        <Label htmlFor="gender">{t("gender")}</Label>
        <Select name="gender" defaultValue={defaultValues?.gender || "UNSPECIFIED"}>
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
      <div className="grid grid-cols-3 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="bloodType">Blood Type</Label>
          <Input id="bloodType" name="bloodType" defaultValue={defaultValues?.bloodType} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="nationality">Nationality</Label>
          <Input id="nationality" name="nationality" defaultValue={defaultValues?.nationality} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="nrcNumber">NRC / ID Number</Label>
          <Input id="nrcNumber" name="nrcNumber" defaultValue={defaultValues?.nrcNumber} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="heightCm">Height (cm)</Label>
          <Input
            id="heightCm"
            name="heightCm"
            type="number"
            step="0.1"
            defaultValue={defaultValues?.heightCm}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="weightKg">Weight (kg)</Label>
          <Input
            id="weightKg"
            name="weightKg"
            type="number"
            step="0.1"
            defaultValue={defaultValues?.weightKg}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="insuranceProvider">{t("insuranceProvider")}</Label>
          <Input
            id="insuranceProvider"
            name="insuranceProvider"
            defaultValue={defaultValues?.insuranceProvider}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="insurancePolicyNumber">{t("insurancePolicyNumber")}</Label>
          <Input
            id="insurancePolicyNumber"
            name="insurancePolicyNumber"
            defaultValue={defaultValues?.insurancePolicyNumber}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="insuranceGroupNumber">Group Number</Label>
          <Input
            id="insuranceGroupNumber"
            name="insuranceGroupNumber"
            defaultValue={defaultValues?.insuranceGroupNumber}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="insuranceCoverageType">Coverage Type</Label>
          <Input
            id="insuranceCoverageType"
            name="insuranceCoverageType"
            defaultValue={defaultValues?.insuranceCoverageType}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="insurancePolicyHolder">Policy Holder</Label>
          <Input
            id="insurancePolicyHolder"
            name="insurancePolicyHolder"
            defaultValue={defaultValues?.insurancePolicyHolder}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="insuranceExpiryDate">Expiry Date</Label>
          <Input
            id="insuranceExpiryDate"
            name="insuranceExpiryDate"
            type="date"
            defaultValue={defaultValues?.insuranceExpiryDate}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="emergencyContactName">{t("emergencyContactName")}</Label>
          <Input
            id="emergencyContactName"
            name="emergencyContactName"
            defaultValue={defaultValues?.emergencyContactName}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="emergencyContactRelationship">Relationship</Label>
          <Input
            id="emergencyContactRelationship"
            name="emergencyContactRelationship"
            defaultValue={defaultValues?.emergencyContactRelationship}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="emergencyContactPhone">{t("emergencyContactPhone")}</Label>
          <Input
            id="emergencyContactPhone"
            name="emergencyContactPhone"
            defaultValue={defaultValues?.emergencyContactPhone}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="emergencyContactAltPhone">Alternate Phone</Label>
          <Input
            id="emergencyContactAltPhone"
            name="emergencyContactAltPhone"
            defaultValue={defaultValues?.emergencyContactAltPhone}
          />
        </div>
        <div className="col-span-2 grid gap-2">
          <Label htmlFor="emergencyContactAddress">Emergency Contact Address</Label>
          <Input
            id="emergencyContactAddress"
            name="emergencyContactAddress"
            defaultValue={defaultValues?.emergencyContactAddress}
          />
        </div>
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

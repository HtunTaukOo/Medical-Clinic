"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import {
  updateOwnDoctorProfile,
  type UpdateOwnDoctorProfileState,
} from "@/actions/staff";
import { ChipListInput } from "@/components/staff/chip-list-input";
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

const FIELD_LABEL = "text-xs font-semibold tracking-wide text-muted-foreground uppercase";

export function DoctorSpecialtyForm({
  specialty,
  qualifications,
  medicalLicenseNo,
  mbbsUniversity,
  graduationYear,
  languages,
  professionalBio,
  clinicRoom,
  consultationHours,
  specialties,
}: {
  specialty: string;
  qualifications: string;
  medicalLicenseNo: string;
  mbbsUniversity: string;
  graduationYear: string;
  languages: string[];
  professionalBio: string;
  clinicRoom: string;
  consultationHours: string;
  specialties: { name: string }[];
}) {
  const t = useTranslations("staff");
  const [state, formAction, pending] = useActionState<
    UpdateOwnDoctorProfileState,
    FormData
  >(updateOwnDoctorProfile, {});
  const [specialtyValue, setSpecialtyValue] = useState(specialty);

  return (
    <form action={formAction} className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="specialty" className={FIELD_LABEL}>
            {t("specialty")}
          </Label>
          <Select name="specialty" value={specialtyValue} onValueChange={setSpecialtyValue}>
            <SelectTrigger id="specialty" className="w-full">
              <SelectValue placeholder={t("selectSpecialty")} />
            </SelectTrigger>
            <SelectContent>
              {specialties.map((s) => (
                <SelectItem key={s.name} value={s.name}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="medicalLicenseNo" className={FIELD_LABEL}>
            {t("medicalLicenseNumber")}
          </Label>
          <Input id="medicalLicenseNo" name="medicalLicenseNo" defaultValue={medicalLicenseNo} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="mbbsUniversity" className={FIELD_LABEL}>
            {t("mbbsUniversity")}
          </Label>
          <Input id="mbbsUniversity" name="mbbsUniversity" defaultValue={mbbsUniversity} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="graduationYear" className={FIELD_LABEL}>
            {t("graduationYear")}
          </Label>
          <Input
            id="graduationYear"
            name="graduationYear"
            type="number"
            min={1900}
            max={2100}
            defaultValue={graduationYear}
          />
        </div>
      </div>

      <div className="grid gap-1.5">
        <p className={FIELD_LABEL}>{t("qualifications")}</p>
        <ChipListInput
          name="qualifications"
          defaultValues={qualifications ? qualifications.split(",").map((q) => q.trim()).filter(Boolean) : []}
          placeholder={t("addQualification")}
          joinAsCsv
        />
      </div>

      <div className="grid gap-1.5">
        <p className={FIELD_LABEL}>{t("languages")}</p>
        <ChipListInput name="languages" defaultValues={languages} placeholder={t("addLanguage")} />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="professionalBio" className={FIELD_LABEL}>
          {t("professionalBio")}
        </Label>
        <Textarea id="professionalBio" name="professionalBio" rows={3} defaultValue={professionalBio} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="clinicRoom" className={FIELD_LABEL}>
            {t("clinicRoom")}
          </Label>
          <Input id="clinicRoom" name="clinicRoom" defaultValue={clinicRoom} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="consultationHours" className={FIELD_LABEL}>
            {t("consultationHours")}
          </Label>
          <Input id="consultationHours" value={consultationHours} disabled />
        </div>
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && <p className="text-sm text-blue-600">{t("saved")}</p>}

      <Button type="submit" disabled={pending} className="w-fit justify-self-end">
        {t("saveChanges")}
      </Button>
    </form>
  );
}

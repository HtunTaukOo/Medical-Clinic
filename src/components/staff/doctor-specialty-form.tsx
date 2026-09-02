"use client";

import { useActionState } from "react";
import {
  updateOwnDoctorProfile,
  type UpdateOwnDoctorProfileState,
} from "@/actions/staff";
import { ChipListInput } from "@/components/staff/chip-list-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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
}) {
  const [state, formAction, pending] = useActionState<
    UpdateOwnDoctorProfileState,
    FormData
  >(updateOwnDoctorProfile, {});

  return (
    <form action={formAction} className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="specialty" className={FIELD_LABEL}>
            Specialty
          </Label>
          <Input id="specialty" name="specialty" defaultValue={specialty} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="medicalLicenseNo" className={FIELD_LABEL}>
            Medical License No.
          </Label>
          <Input id="medicalLicenseNo" name="medicalLicenseNo" defaultValue={medicalLicenseNo} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="mbbsUniversity" className={FIELD_LABEL}>
            MBBS University
          </Label>
          <Input id="mbbsUniversity" name="mbbsUniversity" defaultValue={mbbsUniversity} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="graduationYear" className={FIELD_LABEL}>
            Graduation Year
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
        <p className={FIELD_LABEL}>Qualifications</p>
        <ChipListInput
          name="qualifications"
          defaultValues={qualifications ? qualifications.split(",").map((q) => q.trim()).filter(Boolean) : []}
          placeholder="+ Add qualification"
          joinAsCsv
        />
      </div>

      <div className="grid gap-1.5">
        <p className={FIELD_LABEL}>Languages</p>
        <ChipListInput name="languages" defaultValues={languages} placeholder="+ Add language" />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="professionalBio" className={FIELD_LABEL}>
          Professional Bio
        </Label>
        <Textarea id="professionalBio" name="professionalBio" rows={3} defaultValue={professionalBio} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="clinicRoom" className={FIELD_LABEL}>
            Clinic Room
          </Label>
          <Input id="clinicRoom" name="clinicRoom" defaultValue={clinicRoom} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="consultationHours" className={FIELD_LABEL}>
            Consultation Hours
          </Label>
          <Input id="consultationHours" value={consultationHours} disabled />
        </div>
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && <p className="text-sm text-blue-600">Saved.</p>}

      <Button type="submit" disabled={pending} className="w-fit justify-self-end">
        Save Changes
      </Button>
    </form>
  );
}

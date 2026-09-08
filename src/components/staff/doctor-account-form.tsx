"use client";

import { useActionState } from "react";
import {
  adminUpdateDoctorAccount,
  type AdminUpdateDoctorAccountState,
} from "@/actions/staff";
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

export function DoctorAccountForm({
  doctorId,
  currentName,
  currentEmail,
  currentPhone,
  currentSpecialty,
  currentFee,
  currentExperienceYears,
  currentQualifications,
  specialties,
}: {
  doctorId: string;
  currentName: string;
  currentEmail: string;
  currentPhone?: string | null;
  currentSpecialty?: string | null;
  currentFee: number;
  currentExperienceYears?: number | null;
  currentQualifications?: string | null;
  specialties: { name: string }[];
}) {
  const boundAction = adminUpdateDoctorAccount.bind(null, doctorId);
  const [state, formAction, pending] = useActionState<AdminUpdateDoctorAccountState, FormData>(
    boundAction,
    {}
  );

  return (
    <form action={formAction} className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1">
          <Label htmlFor={`name-${doctorId}`} className="text-xs">
            Name
          </Label>
          <Input id={`name-${doctorId}`} name="name" defaultValue={currentName} required />
        </div>
        <div className="grid gap-1">
          <Label htmlFor={`email-${doctorId}`} className="text-xs">
            Email
          </Label>
          <Input
            id={`email-${doctorId}`}
            name="email"
            type="email"
            defaultValue={currentEmail}
            required
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1">
          <Label htmlFor={`phone-${doctorId}`} className="text-xs">
            Phone
          </Label>
          <Input id={`phone-${doctorId}`} name="phone" defaultValue={currentPhone ?? ""} />
        </div>
        <div className="grid gap-1">
          <Label htmlFor={`specialty-${doctorId}`} className="text-xs">
            Specialty
          </Label>
          <Select name="specialty" defaultValue={currentSpecialty ?? undefined}>
            <SelectTrigger id={`specialty-${doctorId}`} className="w-full">
              <SelectValue placeholder="Select specialty" />
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
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1">
          <Label htmlFor={`fee-${doctorId}`} className="text-xs">
            Consultation Fee
          </Label>
          <Input
            id={`fee-${doctorId}`}
            name="consultationFee"
            type="number"
            min={0}
            step="0.01"
            defaultValue={currentFee}
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor={`exp-${doctorId}`} className="text-xs">
            Years of Experience
          </Label>
          <Input
            id={`exp-${doctorId}`}
            name="experienceYears"
            type="number"
            min={0}
            step="1"
            defaultValue={currentExperienceYears ?? ""}
          />
        </div>
      </div>

      <div className="grid gap-1">
        <Label htmlFor={`qual-${doctorId}`} className="text-xs">
          Qualifications
        </Label>
        <Input
          id={`qual-${doctorId}`}
          name="qualifications"
          placeholder="e.g. MBBS, MMedSc (Obs & Gyn)"
          defaultValue={currentQualifications ?? ""}
        />
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && <p className="text-sm text-primary">Saved.</p>}

      <Button type="submit" disabled={pending} className="w-fit justify-self-end">
        Save Changes
      </Button>
    </form>
  );
}

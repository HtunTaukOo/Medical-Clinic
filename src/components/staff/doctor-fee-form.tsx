"use client";

import { useActionState } from "react";
import { updateDoctorFee, type DoctorFeeFormState } from "@/actions/staff";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DoctorFeeForm({
  doctorId,
  currentFee,
  currentExperienceYears,
  currentQualifications,
}: {
  doctorId: string;
  currentFee: number;
  currentExperienceYears?: number | null;
  currentQualifications?: string | null;
}) {
  const boundAction = updateDoctorFee.bind(null, doctorId);
  const [state, formAction, pending] = useActionState<DoctorFeeFormState, FormData>(
    boundAction,
    {}
  );

  return (
    <form action={formAction} className="grid gap-2">
      <div className="flex flex-wrap items-end gap-2">
        <div className="grid gap-1">
          <Label htmlFor={`fee-${doctorId}`} className="text-xs">
            Fee
          </Label>
          <Input
            id={`fee-${doctorId}`}
            name="consultationFee"
            type="number"
            min={0}
            step="0.01"
            defaultValue={currentFee}
            className="w-24"
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor={`exp-${doctorId}`} className="text-xs">
            Yrs exp.
          </Label>
          <Input
            id={`exp-${doctorId}`}
            name="experienceYears"
            type="number"
            min={0}
            step="1"
            defaultValue={currentExperienceYears ?? ""}
            className="w-20"
          />
        </div>
        <Button size="sm" variant="outline" type="submit" disabled={pending}>
          Save
        </Button>
        {state.error && <span className="text-sm text-destructive">{state.error}</span>}
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
          className="max-w-xs"
        />
      </div>
    </form>
  );
}

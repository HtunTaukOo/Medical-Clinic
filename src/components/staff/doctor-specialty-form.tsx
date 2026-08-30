"use client";

import { useActionState } from "react";
import {
  updateOwnDoctorProfile,
  type UpdateOwnDoctorProfileState,
} from "@/actions/staff";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function DoctorSpecialtyForm({
  specialty,
  qualifications,
  experienceYears,
}: {
  specialty: string;
  qualifications: string;
  experienceYears: string;
}) {
  const [state, formAction, pending] = useActionState<
    UpdateOwnDoctorProfileState,
    FormData
  >(updateOwnDoctorProfile, {});

  return (
    <form action={formAction} className="grid max-w-md gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="specialty">Specialty</Label>
        <Input id="specialty" name="specialty" defaultValue={specialty} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="experienceYears">Years of experience</Label>
        <Input
          id="experienceYears"
          name="experienceYears"
          type="number"
          min={0}
          defaultValue={experienceYears}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="qualifications">Qualifications</Label>
        <Textarea
          id="qualifications"
          name="qualifications"
          rows={3}
          defaultValue={qualifications}
        />
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && <p className="text-sm text-emerald-600">Saved.</p>}
      <Button type="submit" disabled={pending} className="w-fit">
        Save
      </Button>
    </form>
  );
}

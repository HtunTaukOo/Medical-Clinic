"use client";

import { useActionState } from "react";
import { addDoctorLeave, type DoctorLeaveFormState } from "@/actions/staff";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DoctorLeaveForm({ doctorId }: { doctorId: string }) {
  const boundAction = addDoctorLeave.bind(null, doctorId);
  const [state, formAction, pending] = useActionState<DoctorLeaveFormState, FormData>(
    boundAction,
    {}
  );

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <div className="grid gap-1.5">
        <Label htmlFor={`leave-date-${doctorId}`}>Date</Label>
        <Input id={`leave-date-${doctorId}`} name="date" type="date" required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`leave-reason-${doctorId}`}>Reason (optional)</Label>
        <Input id={`leave-reason-${doctorId}`} name="reason" placeholder="e.g. Vacation" />
      </div>
      <Button size="sm" variant="outline" type="submit" disabled={pending}>
        Add leave day
      </Button>
      {state.error && <span className="text-sm text-destructive">{state.error}</span>}
    </form>
  );
}

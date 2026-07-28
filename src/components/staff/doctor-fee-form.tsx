"use client";

import { useActionState } from "react";
import { updateDoctorFee, type DoctorFeeFormState } from "@/actions/staff";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function DoctorFeeForm({
  doctorId,
  currentFee,
}: {
  doctorId: string;
  currentFee: number;
}) {
  const boundAction = updateDoctorFee.bind(null, doctorId);
  const [state, formAction, pending] = useActionState<DoctorFeeFormState, FormData>(
    boundAction,
    {}
  );

  return (
    <form action={formAction} className="flex items-center gap-2">
      <Input
        name="consultationFee"
        type="number"
        min={0}
        step="0.01"
        defaultValue={currentFee}
        className="w-24"
      />
      <Button size="sm" variant="outline" type="submit" disabled={pending}>
        Save fee
      </Button>
      {state.error && <span className="text-sm text-destructive">{state.error}</span>}
    </form>
  );
}

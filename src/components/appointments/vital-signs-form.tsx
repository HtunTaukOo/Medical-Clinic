"use client";

import { useActionState } from "react";
import { updateVitals, type VitalsFormState } from "@/actions/appointments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type VitalsDefaults = {
  bpSystolic: number | null;
  bpDiastolic: number | null;
  heartRateBpm: number | null;
  temperatureC: number | null;
  respiratoryRate: number | null;
  spo2Percent: number | null;
};

export function VitalSignsForm({
  appointmentId,
  defaultValues,
}: {
  appointmentId: string;
  defaultValues: VitalsDefaults;
}) {
  const boundAction = updateVitals.bind(null, appointmentId);
  const [state, formAction, pending] = useActionState<VitalsFormState, FormData>(
    boundAction,
    {}
  );

  return (
    <form action={formAction} className="grid gap-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="bpSystolic">BP systolic</Label>
          <Input
            id="bpSystolic"
            name="bpSystolic"
            type="number"
            placeholder="120"
            defaultValue={defaultValues.bpSystolic ?? ""}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="bpDiastolic">BP diastolic</Label>
          <Input
            id="bpDiastolic"
            name="bpDiastolic"
            type="number"
            placeholder="80"
            defaultValue={defaultValues.bpDiastolic ?? ""}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="heartRateBpm">Heart rate (bpm)</Label>
          <Input
            id="heartRateBpm"
            name="heartRateBpm"
            type="number"
            placeholder="72"
            defaultValue={defaultValues.heartRateBpm ?? ""}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="temperatureC">Temperature (°C)</Label>
          <Input
            id="temperatureC"
            name="temperatureC"
            type="number"
            step="0.1"
            placeholder="36.8"
            defaultValue={defaultValues.temperatureC ?? ""}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="respiratoryRate">Respiratory rate</Label>
          <Input
            id="respiratoryRate"
            name="respiratoryRate"
            type="number"
            placeholder="16"
            defaultValue={defaultValues.respiratoryRate ?? ""}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="spo2Percent">SpO2 (%)</Label>
          <Input
            id="spo2Percent"
            name="spo2Percent"
            type="number"
            placeholder="98"
            defaultValue={defaultValues.spo2Percent ?? ""}
          />
        </div>
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending} className="w-fit">
        Save vitals
      </Button>
    </form>
  );
}

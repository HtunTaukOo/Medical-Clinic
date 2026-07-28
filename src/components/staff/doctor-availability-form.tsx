"use client";

import { useActionState } from "react";
import {
  updateDoctorAvailability,
  type DoctorAvailabilityFormState,
} from "@/actions/staff";
import { WEEKDAY_LABELS } from "@/lib/doctor-availability";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DoctorAvailabilityForm({
  doctorId,
  workingDays,
  workStartTime,
  workEndTime,
}: {
  doctorId: string;
  workingDays: number[];
  workStartTime: string | null;
  workEndTime: string | null;
}) {
  const boundAction = updateDoctorAvailability.bind(null, doctorId);
  const [state, formAction, pending] = useActionState<
    DoctorAvailabilityFormState,
    FormData
  >(boundAction, {});

  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-2">
        <Label>Working days</Label>
        <div className="flex flex-wrap gap-3">
          {WEEKDAY_LABELS.map((label, day) => (
            <label key={day} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                name="workingDays"
                value={day}
                defaultChecked={workingDays.includes(day)}
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor={`workStartTime-${doctorId}`}>Start time (optional)</Label>
          <Input
            id={`workStartTime-${doctorId}`}
            name="workStartTime"
            type="time"
            defaultValue={workStartTime ?? ""}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`workEndTime-${doctorId}`}>End time (optional)</Label>
          <Input
            id={`workEndTime-${doctorId}`}
            name="workEndTime"
            type="time"
            defaultValue={workEndTime ?? ""}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Leave both times blank to use the clinic&apos;s default opening hours for this doctor.
      </p>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && <p className="text-sm text-emerald-600">Saved.</p>}

      <Button type="submit" disabled={pending} className="w-fit">
        Save schedule
      </Button>
    </form>
  );
}

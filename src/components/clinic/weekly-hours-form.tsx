"use client";

import { useActionState, useState } from "react";
import { updateWeeklyHours, type ClinicSettingsFormState } from "@/actions/clinic-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function WeeklyHoursForm({
  days,
}: {
  days: { weekday: number; isOpen: boolean; openTime: string; closeTime: string }[];
}) {
  const [state, formAction, pending] = useActionState<ClinicSettingsFormState, FormData>(
    updateWeeklyHours,
    {}
  );
  const [openDays, setOpenDays] = useState<Record<number, boolean>>(
    Object.fromEntries(days.map((d) => [d.weekday, d.isOpen]))
  );

  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-px overflow-hidden rounded-lg border bg-border">
        <div className="grid grid-cols-[1.2fr_1fr_1fr_auto] items-center gap-4 bg-muted px-3 py-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          <span>Day</span>
          <span>Open Time</span>
          <span>Close Time</span>
          <span>Open</span>
        </div>
        {days.map((day) => (
          <div
            key={day.weekday}
            className="grid grid-cols-[1.2fr_1fr_1fr_auto] items-center gap-4 bg-card px-3 py-2"
          >
            <span className="text-sm font-medium">{DAY_LABELS[day.weekday]}</span>
            <Input
              type="time"
              name={`openTime-${day.weekday}`}
              defaultValue={day.openTime}
              className={openDays[day.weekday] ? undefined : "opacity-50"}
            />
            <Input
              type="time"
              name={`closeTime-${day.weekday}`}
              defaultValue={day.closeTime}
              className={openDays[day.weekday] ? undefined : "opacity-50"}
            />
            <Switch
              checked={openDays[day.weekday]}
              onCheckedChange={(value) =>
                setOpenDays((prev) => ({ ...prev, [day.weekday]: value }))
              }
            />
            <input
              type="hidden"
              name={`isOpen-${day.weekday}`}
              value={openDays[day.weekday] ? "on" : ""}
            />
          </div>
        ))}
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && <p className="text-sm text-primary">Saved.</p>}

      <Button type="submit" disabled={pending} className="w-fit">
        Save Working Hours
      </Button>
    </form>
  );
}

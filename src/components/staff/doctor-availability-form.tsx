"use client";

import { useState } from "react";
import { useActionState } from "react";
import {
  updateDoctorAvailability,
  type DoctorAvailabilityFormState,
} from "@/actions/staff";
import { WEEKDAY_LABELS } from "@/lib/doctor-availability";
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

type ShiftRow = { key: string; weekday: number; startTime: string; endTime: string };

export function DoctorAvailabilityForm({
  doctorId,
  workingDays,
  shifts,
}: {
  doctorId: string;
  workingDays: number[];
  shifts: { weekday: number; startTime: string; endTime: string }[];
}) {
  const boundAction = updateDoctorAvailability.bind(null, doctorId);
  const [state, formAction, pending] = useActionState<
    DoctorAvailabilityFormState,
    FormData
  >(boundAction, {});
  const [days, setDays] = useState<number[]>(workingDays);
  const [rows, setRows] = useState<ShiftRow[]>(
    shifts.map((s, i) => ({ key: `existing-${i}`, ...s }))
  );
  const [newWeekday, setNewWeekday] = useState("1");
  const [newStart, setNewStart] = useState("09:00");
  const [newEnd, setNewEnd] = useState("17:00");

  function addRow() {
    setRows((r) => [
      ...r,
      { key: `${Date.now()}-${Math.random()}`, weekday: Number(newWeekday), startTime: newStart, endTime: newEnd },
    ]);
  }

  function removeRow(key: string) {
    setRows((r) => r.filter((row) => row.key !== key));
  }

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
                checked={days.includes(day)}
                onChange={(e) =>
                  setDays((d) => (e.target.checked ? [...d, day] : d.filter((x) => x !== day)))
                }
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-2">
        <Label>Time ranges</Label>
        <p className="text-xs text-muted-foreground">
          Add one or more ranges per day (e.g. a morning and an evening shift with a break
          between). A working day with no ranges uses the clinic&apos;s default opening hours.
        </p>

        {rows.length > 0 && (
          <div className="grid gap-1.5">
            {rows.map((row) => (
              <div key={row.key} className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm">
                <input type="hidden" name="shiftWeekday" value={row.weekday} />
                <input type="hidden" name="shiftStart" value={row.startTime} />
                <input type="hidden" name="shiftEnd" value={row.endTime} />
                <span className="w-9 shrink-0 font-medium">{WEEKDAY_LABELS[row.weekday]}</span>
                <span className="flex-1 text-muted-foreground">
                  {row.startTime} – {row.endTime}
                </span>
                <button
                  type="button"
                  onClick={() => removeRow(row.key)}
                  className="text-xs font-medium text-destructive underline underline-offset-2"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-end gap-2">
          <Select value={newWeekday} onValueChange={setNewWeekday}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WEEKDAY_LABELS.map((label, day) => (
                <SelectItem key={day} value={String(day)}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="time" value={newStart} onChange={(e) => setNewStart(e.target.value)} className="w-32" />
          <span className="text-sm text-muted-foreground">to</span>
          <Input type="time" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} className="w-32" />
          <Button type="button" variant="outline" size="sm" onClick={addRow}>
            + Add range
          </Button>
        </div>
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && <p className="text-sm text-emerald-600">Saved.</p>}

      <Button type="submit" disabled={pending} className="w-fit">
        Save schedule
      </Button>
    </form>
  );
}

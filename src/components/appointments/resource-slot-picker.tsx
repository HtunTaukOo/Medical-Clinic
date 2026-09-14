"use client";

import { useEffect, useState, useTransition } from "react";
import { fetchResourceDaySlots } from "@/actions/booking";
import type { DaySlot } from "@/lib/booking-slots";
import { formatTimeLabel } from "@/lib/time-blocks";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// SERVICE_CAPACITY counterpart to BlockPicker — a continuous half-hour grid
// shared across every doctor tagged with the specialty (e.g. Lab Visit),
// instead of fixed blocks. Used by staff/doctor manual booking and walk-in
// registration so those flows get the same real shared-capacity check the
// patient booking wizard already does, instead of just picking a time with
// no availability check at all.
export function ResourceSlotPicker({
  specialtyName,
  capacityPerSlot,
  dateInputName = "resourceDate",
  timeInputName = "resourceTime",
  defaultDate,
  defaultTime,
}: {
  specialtyName: string;
  capacityPerSlot: number;
  dateInputName?: string;
  timeInputName?: string;
  defaultDate?: string;
  defaultTime?: string;
}) {
  const [date, setDate] = useState(defaultDate ?? "");
  const [time, setTime] = useState<string | null>(defaultTime ?? null);
  const [slots, setSlots] = useState<DaySlot[]>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!date) return;
    const [year, month, day] = date.split("-").map(Number);
    if (!year || !month || !day) return;
    startTransition(async () => {
      const result = await fetchResourceDaySlots(specialtyName, capacityPerSlot, year, month, day);
      setSlots(result);
    });
  }, [date, specialtyName, capacityPerSlot]);

  const visibleSlots = date ? slots : [];

  return (
    <div className="grid gap-2">
      <Label htmlFor="resource-picker-date">Date</Label>
      <Input
        id="resource-picker-date"
        type="date"
        required
        value={date}
        onChange={(e) => {
          setDate(e.target.value);
          setTime(null);
        }}
      />
      <input type="hidden" name={dateInputName} value={date} />
      <input type="hidden" name={timeInputName} value={time ?? ""} />

      {date && (
        <div className="grid gap-2">
          <Label>Time</Label>
          {pending ? (
            <p className="text-sm text-muted-foreground">Loading times…</p>
          ) : visibleSlots.length === 0 ? (
            <p className="text-sm text-muted-foreground">No times available this day.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {visibleSlots.map((s) => {
                const selected = time === s.time;
                return (
                  <button
                    key={s.time}
                    type="button"
                    disabled={!s.available}
                    onClick={() => setTime(s.time)}
                    className={`rounded-lg border px-2 py-1.5 text-sm font-medium transition-colors ${
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : s.available
                          ? "hover:bg-muted/50"
                          : "text-muted-foreground/40 line-through"
                    }`}
                  >
                    {formatTimeLabel(s.time)}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

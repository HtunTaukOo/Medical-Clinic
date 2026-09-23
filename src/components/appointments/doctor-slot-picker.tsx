"use client";

import { useEffect, useState, useTransition } from "react";
import { fetchDaySlots } from "@/actions/booking";
import type { DaySlot } from "@/lib/booking-slots";
import { formatTimeLabel } from "@/lib/time-blocks";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Myanmar has used a single fixed UTC+6:30 offset with no DST since 1920
// (see src/lib/clinic-hours.ts), so appending it here lets the server parse
// this value as the exact clinic-local instant regardless of its own
// runtime timezone, without duplicating any clinic-local date math here.
const CLINIC_UTC_OFFSET = "+06:30";

// Doctor-shift-aware date + slot picker for regular (DOCTOR_CALENDAR)
// specialties, used by staff/doctor manual appointment creation — mirrors
// BlockPicker's date-input + fetched-slots pattern for BLOCK_CAPACITY
// specialties, but backed by getDaySlots (per-doctor shift ranges, falling
// back to the clinic's own hours only when a doctor has no shift set for
// that day) instead of shared time blocks.
export function DoctorSlotPicker({
  doctorId,
  inputName = "scheduledAt",
  defaultDate,
}: {
  doctorId: string;
  inputName?: string;
  defaultDate?: string;
}) {
  const [date, setDate] = useState(defaultDate ?? "");
  const [time, setTime] = useState<string | null>(null);
  const [slots, setSlots] = useState<DaySlot[]>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!date || !doctorId) return;
    const [year, month, day] = date.split("-").map(Number);
    if (!year || !month || !day) return;
    startTransition(async () => {
      const result = await fetchDaySlots(doctorId, year, month, day);
      setSlots(result);
    });
  }, [date, doctorId]);

  const scheduledAt = date && time ? `${date}T${time}:00${CLINIC_UTC_OFFSET}` : "";
  const visibleSlots = date && doctorId ? slots : [];

  return (
    <div className="grid gap-2">
      <Label htmlFor="doctor-slot-date">Date</Label>
      <Input
        id="doctor-slot-date"
        type="date"
        required
        value={date}
        onChange={(e) => {
          setDate(e.target.value);
          setTime(null);
        }}
        disabled={!doctorId}
      />
      <input type="hidden" name={inputName} value={scheduledAt} />

      {!doctorId ? (
        <p className="text-sm text-muted-foreground">Select a doctor first.</p>
      ) : (
        date && (
          <div className="grid gap-2">
            <Label>Time</Label>
            {pending ? (
              <p className="text-sm text-muted-foreground">Loading availability…</p>
            ) : visibleSlots.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                This doctor isn&rsquo;t in clinic this day.
              </p>
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
                      className={`rounded-lg border py-2 text-sm font-medium transition-colors ${
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
        )
      )}
    </div>
  );
}

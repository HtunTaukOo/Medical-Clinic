"use client";

import { useActionState, useEffect, useState } from "react";
import {
  createSpecialty,
  updateSpecialty,
  type SpecialtyFormState,
} from "@/actions/specialties";
import { SPECIALTY_ICON_NAMES, getSpecialtyIcon } from "@/lib/specialties";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type BookingMode = "DOCTOR_CALENDAR" | "SERVICE_CAPACITY" | "BLOCK_CAPACITY";

const BOOKING_MODE_COPY: Record<BookingMode, { label: string; hint: string }> = {
  DOCTOR_CALENDAR: {
    label: "Doctor calendar",
    hint: "Patients pick a doctor directly, then an exact time from that doctor's own calendar.",
  },
  SERVICE_CAPACITY: {
    label: "Book by service",
    hint: "Patients pick a service (e.g. \"Blood Work\") instead of a doctor — for services like Laboratory where the specific doctor doesn't matter. Availability is checked against clinic hours and the capacity below instead of any one doctor's calendar. A doctor is still assigned behind the scenes for record-keeping, so at least one doctor profile needs this specialty set.",
  },
  BLOCK_CAPACITY: {
    label: "Time blocks",
    hint: "Patients pick a date and one of 5 fixed daily time blocks (shared capacity below, pooled across every doctor with this specialty), then pick a specific doctor.",
  },
};

export function SpecialtyForm({
  specialty,
  onSaved,
}: {
  specialty?: {
    id: string;
    name: string;
    icon: string;
    description: string | null;
    bookingMode: BookingMode;
    capacityPerSlot: number;
  };
  onSaved?: () => void;
}) {
  const action = specialty ? updateSpecialty.bind(null, specialty.id) : createSpecialty;
  const [state, formAction, pending] = useActionState<SpecialtyFormState, FormData>(action, {});
  const [icon, setIcon] = useState(specialty?.icon ?? SPECIALTY_ICON_NAMES[0]);
  const [bookingMode, setBookingMode] = useState<BookingMode>(
    specialty?.bookingMode ?? "BLOCK_CAPACITY"
  );

  useEffect(() => {
    if (state.success && onSaved) onSaved();
  }, [state.success, onSaved]);

  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="name">Specialty Name</Label>
        <Input
          id="name"
          name="name"
          required
          defaultValue={specialty?.name}
          placeholder="e.g. Psychiatry"
        />
        {specialty && (
          <p className="text-xs text-muted-foreground">
            Renaming updates every doctor and clinic service currently set to &quot;
            {specialty.name}&quot; to the new name automatically.
          </p>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          rows={2}
          defaultValue={specialty?.description ?? ""}
          placeholder="Shown under the specialty in the booking wizard"
        />
      </div>

      <div className="grid gap-2">
        <Label>Icon</Label>
        <div className="grid grid-cols-6 gap-2">
          {SPECIALTY_ICON_NAMES.map((name) => {
            const Icon = getSpecialtyIcon(name);
            const selected = icon === name;
            return (
              <button
                key={name}
                type="button"
                onClick={() => setIcon(name)}
                aria-label={name}
                aria-pressed={selected}
                className={`flex size-10 items-center justify-center rounded-lg border transition-colors ${
                  selected
                    ? "border-primary bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                <Icon className="size-5" />
              </button>
            );
          })}
        </div>
        <input type="hidden" name="icon" value={icon} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="bookingMode">Booking Mode</Label>
        <Select value={bookingMode} onValueChange={(v) => setBookingMode(v as BookingMode)}>
          <SelectTrigger id="bookingMode" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(BOOKING_MODE_COPY) as BookingMode[]).map((mode) => (
              <SelectItem key={mode} value={mode}>
                {BOOKING_MODE_COPY[mode].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input type="hidden" name="bookingMode" value={bookingMode} />
        <p className="text-xs text-muted-foreground">{BOOKING_MODE_COPY[bookingMode].hint}</p>
      </div>

      {bookingMode !== "DOCTOR_CALENDAR" && (
        <div className="grid gap-2">
          <Label htmlFor="capacityPerSlot">
            {bookingMode === "BLOCK_CAPACITY" ? "Capacity per time block" : "Capacity per 30-min slot"}
          </Label>
          <Input
            id="capacityPerSlot"
            name="capacityPerSlot"
            type="number"
            min={1}
            max={50}
            defaultValue={specialty?.capacityPerSlot ?? (bookingMode === "BLOCK_CAPACITY" ? 10 : 1)}
            className="w-32"
          />
          <p className="text-xs text-muted-foreground">
            How many patients this specialty can handle at the same time (e.g. 10 patients per
            time block, or 3 lab stations). Once a slot reaches this many bookings, patients see
            it as full.
          </p>
        </div>
      )}

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending} className="w-fit">
        {specialty ? "Save Changes" : "Add Specialty"}
      </Button>
    </form>
  );
}

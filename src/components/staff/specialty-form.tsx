"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
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

const BOOKING_MODE_KEYS = {
  DOCTOR_CALENDAR: {
    label: "doctorCalendar",
    hint: "doctorCalendarHelp",
  },
  SERVICE_CAPACITY: {
    label: "bookByService",
    hint: "bookByServiceHelp",
  },
  BLOCK_CAPACITY: {
    label: "timeBlocks",
    hint: "timeBlocksHelp",
  },
} as const;

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
  const t = useTranslations("clinicServices");
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
        <Label htmlFor="name">{t("specialtyName")}</Label>
        <Input
          id="name"
          name="name"
          required
          defaultValue={specialty?.name}
          placeholder={t("specialtyPlaceholder")}
        />
        {specialty && (
          <p className="text-xs text-muted-foreground">
            {t("specialtyRenameHelp", { name: specialty.name })}
          </p>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="description">{t("description")}</Label>
        <Textarea
          id="description"
          name="description"
          rows={2}
          defaultValue={specialty?.description ?? ""}
          placeholder={t("specialtyDescriptionPlaceholder")}
        />
      </div>

      <div className="grid gap-2">
        <Label>{t("icon")}</Label>
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
        <Label htmlFor="bookingMode">{t("bookingMode")}</Label>
        <Select value={bookingMode} onValueChange={(v) => setBookingMode(v as BookingMode)}>
          <SelectTrigger id="bookingMode" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(BOOKING_MODE_KEYS) as BookingMode[]).map((mode) => (
              <SelectItem key={mode} value={mode}>
                {t(BOOKING_MODE_KEYS[mode].label)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input type="hidden" name="bookingMode" value={bookingMode} />
        <p className="text-xs text-muted-foreground">{t(BOOKING_MODE_KEYS[bookingMode].hint)}</p>
      </div>

      {bookingMode !== "DOCTOR_CALENDAR" && (
        <div className="grid gap-2">
          <Label htmlFor="capacityPerSlot">
            {bookingMode === "BLOCK_CAPACITY" ? t("capacityPerTimeBlock") : t("capacityPerSlot")}
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
            {t("capacityHelp")}
          </p>
        </div>
      )}

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending} className="w-fit">
        {specialty ? t("saveChanges") : t("addSpecialty")}
      </Button>
    </form>
  );
}

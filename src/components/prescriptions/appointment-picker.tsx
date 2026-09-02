"use client";

import { AlertTriangle } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import { AVATAR_COLORS } from "@/components/appointments/appointment-row";

export type EligibleAppointment = {
  id: string;
  patientName: string;
  allergy: string | null;
  time: string;
  reason: string | null;
};

export function AppointmentPicker({
  appointments,
  onSelect,
}: {
  appointments: EligibleAppointment[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {appointments.map((appt, index) => (
        <button
          key={appt.id}
          type="button"
          onClick={() => onSelect(appt.id)}
          className="flex items-start gap-3 rounded-xl border p-3 text-left transition-colors hover:border-primary hover:bg-primary/5"
        >
          <Avatar className="size-9">
            <AvatarFallback className={AVATAR_COLORS[index % AVATAR_COLORS.length]}>
              {initials(appt.patientName)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{appt.patientName}</p>
            <p className="text-xs text-muted-foreground">
              {appt.time}
              {appt.reason ? ` · ${appt.reason}` : ""}
            </p>
            {appt.allergy && (
              <p className="flex items-center gap-1 text-xs text-destructive">
                <AlertTriangle className="size-3" />
                {appt.allergy}
              </p>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

"use client";

import { useState } from "react";
import { CalendarClock } from "lucide-react";
import { createPrescription } from "@/actions/prescriptions";
import { AppointmentPicker, type EligibleAppointment } from "@/components/prescriptions/appointment-picker";
import { PrescriptionForm } from "@/components/prescriptions/prescription-form";
import { EmptyState } from "@/components/empty-state";

export function CreatePrescriptionPanel({
  appointments,
  medicines,
}: {
  appointments: EligibleAppointment[];
  medicines: { id: string; name: string; unit: string }[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (appointments.length === 0) {
    return (
      <EmptyState
        icon={CalendarClock}
        message="No patients are confirmed or checked in today. Prescriptions can only be written against today's appointments."
      />
    );
  }

  const selected = appointments.find((a) => a.id === selectedId) ?? null;

  if (!selected) {
    return (
      <div className="grid gap-3">
        <p className="text-sm text-muted-foreground">
          Select today&apos;s appointment to prescribe for:
        </p>
        <AppointmentPicker appointments={appointments} onSelect={setSelectedId} />
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between rounded-lg border bg-blue-50 p-3">
        <div>
          <p className="text-xs font-semibold tracking-wide text-blue-600 uppercase">
            Prescribing for
          </p>
          <p className="font-semibold">
            {selected.patientName} · {selected.time}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSelectedId(null)}
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          Change
        </button>
      </div>
      <PrescriptionForm action={createPrescription.bind(null, selected.id)} medicines={medicines} />
    </div>
  );
}

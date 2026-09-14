"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import {
  convertWalkInToAppointment,
  type ConvertWalkInState,
} from "@/actions/walk-ins";
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

export function ConvertWalkInForm({
  walkInId,
  patients,
  doctors,
  defaultDoctorId,
  defaultSpecialtyName,
  bookByServiceSpecialties,
  blockCapacitySpecialties,
  clinicServices,
}: {
  walkInId: string;
  patients: { id: string; name: string }[];
  doctors: { id: string; name: string; specialty: string | null }[];
  defaultDoctorId?: string;
  // Set instead of defaultDoctorId when the original walk-in ticket's doctor
  // was a SERVICE_CAPACITY placeholder (not a real, pickable doctor) — opens
  // the form straight into the service picker for that specialty.
  defaultSpecialtyName?: string;
  bookByServiceSpecialties: string[];
  blockCapacitySpecialties: string[];
  clinicServices: { id: string; name: string; specialty: string | null }[];
}) {
  const t = useTranslations("appointments");
  const boundAction = convertWalkInToAppointment.bind(null, walkInId);
  const [state, formAction, pending] = useActionState<ConvertWalkInState, FormData>(
    boundAction,
    {}
  );
  const [patientId, setPatientId] = useState("");
  const [newPatientName, setNewPatientName] = useState("");
  const [doctorId, setDoctorId] = useState(defaultDoctorId ?? "");
  const [bookingKind, setBookingKind] = useState<"doctor" | "service">(
    defaultSpecialtyName ? "service" : "doctor"
  );
  const [clinicServiceId, setClinicServiceId] = useState("");

  const hasServiceOption = bookByServiceSpecialties.length > 0;
  const isServiceBooking = hasServiceOption && bookingKind === "service";

  const selectedDoctor = doctors.find((d) => d.id === doctorId);
  const isBlockDoctor = !!selectedDoctor?.specialty && blockCapacitySpecialties.includes(selectedDoctor.specialty);

  const eligibleServices = clinicServices.filter(
    (s) => !!s.specialty && bookByServiceSpecialties.includes(s.specialty)
  );
  const selectedService = eligibleServices.find((s) => s.id === clinicServiceId) ?? null;

  return (
    <form action={formAction} className="grid max-w-md gap-4">
      <div className="grid gap-2">
        <Label htmlFor="patientId">{t("existingPatient")}</Label>
        <Select
          name="patientId"
          value={patientId || undefined}
          onValueChange={(value) => {
            setPatientId(value);
            setNewPatientName("");
          }}
        >
          <SelectTrigger id="patientId" className="w-full">
            <SelectValue placeholder={t("selectPatient")} />
          </SelectTrigger>
          <SelectContent>
            {patients.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="text-center text-sm text-muted-foreground">{t("or")}</p>

      <div className="grid gap-2">
        <Label htmlFor="newPatientName">{t("newPatientName")}</Label>
        <Input
          id="newPatientName"
          name="newPatientName"
          value={newPatientName}
          onChange={(e) => {
            setNewPatientName(e.target.value);
            if (e.target.value) setPatientId("");
          }}
        />
      </div>

      {hasServiceOption && (
        <div className="grid gap-2">
          <Label>Visit Type</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={bookingKind === "doctor" ? "default" : "outline"}
              onClick={() => setBookingKind("doctor")}
            >
              Doctor Visit
            </Button>
            <Button
              type="button"
              size="sm"
              variant={bookingKind === "service" ? "default" : "outline"}
              onClick={() => setBookingKind("service")}
            >
              Lab Visit / Service
            </Button>
          </div>
        </div>
      )}

      {!isServiceBooking && (
        <div className="grid gap-2">
          <Label htmlFor="doctorId">{t("doctor")}</Label>
          <Select name="doctorId" required value={doctorId} onValueChange={setDoctorId}>
            <SelectTrigger id="doctorId" className="w-full">
              <SelectValue placeholder={t("doctor")} />
            </SelectTrigger>
            <SelectContent>
              {doctors.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {isBlockDoctor && !isServiceBooking && (
        <p className="rounded-lg border border-dashed bg-muted/40 p-3 text-sm text-muted-foreground">
          This will register the patient into the current time block for {selectedDoctor?.specialty}.
        </p>
      )}

      {isServiceBooking && (
        <>
          <div className="grid gap-2">
            <Label htmlFor="clinicServiceId">Lab Test / Service</Label>
            <Select
              name="clinicServiceId"
              required
              value={clinicServiceId}
              onValueChange={setClinicServiceId}
            >
              <SelectTrigger id="clinicServiceId" className="w-full">
                <SelectValue placeholder="Select the test or service" />
              </SelectTrigger>
              <SelectContent>
                {eligibleServices.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <input type="hidden" name="specialtyName" value={selectedService?.specialty ?? ""} />
        </>
      )}

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending} className="w-fit">
        {t("startVisit")}
      </Button>
    </form>
  );
}

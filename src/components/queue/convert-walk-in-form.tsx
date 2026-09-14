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
  bookByServiceSpecialties,
  blockCapacitySpecialties,
  clinicServices,
}: {
  walkInId: string;
  patients: { id: string; name: string }[];
  doctors: { id: string; name: string; specialty: string | null }[];
  defaultDoctorId?: string;
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
  const selectedDoctor = doctors.find((d) => d.id === doctorId);
  const needsService = !!selectedDoctor?.specialty && bookByServiceSpecialties.includes(selectedDoctor.specialty);
  const isBlockDoctor = !!selectedDoctor?.specialty && blockCapacitySpecialties.includes(selectedDoctor.specialty);
  const availableServices = clinicServices.filter((s) => s.specialty === selectedDoctor?.specialty);

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

      {isBlockDoctor && (
        <p className="rounded-lg border border-dashed bg-muted/40 p-3 text-sm text-muted-foreground">
          This will register the patient into the current time block for {selectedDoctor?.specialty}.
        </p>
      )}

      {needsService && (
        <div className="grid gap-2">
          <Label htmlFor="clinicServiceId">Lab Test / Service</Label>
          <Select name="clinicServiceId" required>
            <SelectTrigger id="clinicServiceId" className="w-full">
              <SelectValue placeholder="Select the test or service" />
            </SelectTrigger>
            <SelectContent>
              {availableServices.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending} className="w-fit">
        {t("startVisit")}
      </Button>
    </form>
  );
}

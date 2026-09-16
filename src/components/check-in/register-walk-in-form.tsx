"use client";

import { useActionState, useId, useState } from "react";
import { registerAndCheckIn, type RegisterAndCheckInState } from "@/actions/check-in";
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

export function RegisterWalkInForm({
  doctors,
  bookByServiceSpecialties,
  blockCapacitySpecialties,
  clinicServices,
  existingPatient,
}: {
  doctors: { id: string; name: string; specialty: string | null }[];
  bookByServiceSpecialties: string[];
  blockCapacitySpecialties: string[];
  clinicServices: { id: string; name: string; specialty: string | null }[];
  // Set when registering a walk-in visit for an already-registered patient
  // (found via search on /staff/check-in) — skips the name/phone/dob/gender
  // fields entirely and submits their existing patientId instead.
  existingPatient?: { id: string; name: string };
}) {
  const [state, formAction, pending] = useActionState<RegisterAndCheckInState, FormData>(
    registerAndCheckIn,
    {}
  );
  // Two instances of this form can be mounted at once (the static "new
  // patient" panel plus a per-search-result dialog) — hardcoded ids would
  // collide (invalid HTML, broken label associations), so every id is
  // scoped to this instance.
  const uid = useId();
  const [doctorId, setDoctorId] = useState("");
  const [bookingKind, setBookingKind] = useState<"doctor" | "service">("doctor");
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
    <form action={formAction} className="grid gap-4">
      {existingPatient ? (
        <>
          <input type="hidden" name="patientId" value={existingPatient.id} />
          <p className="rounded-lg border border-dashed bg-muted/40 p-3 text-sm">
            Registering a walk-in visit for <span className="font-medium">{existingPatient.name}</span>.
          </p>
        </>
      ) : (
        <div className="grid gap-2">
          <Label htmlFor={`${uid}-name`}>Full Name</Label>
          <Input id={`${uid}-name`} name="name" placeholder="e.g. Ko Tun Aung" required />
        </div>
      )}

      {!existingPatient && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor={`${uid}-phone`}>Phone Number</Label>
            <Input id={`${uid}-phone`} name="phone" placeholder="09 420000000" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${uid}-dob`}>Date of Birth</Label>
            <Input id={`${uid}-dob`} name="dob" type="date" />
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {!existingPatient && (
          <div className="grid gap-2">
            <Label htmlFor={`${uid}-gender`}>Gender</Label>
            <Select name="gender">
              <SelectTrigger id={`${uid}-gender`} className="w-full">
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MALE">Male</SelectItem>
                <SelectItem value="FEMALE">Female</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        {!isServiceBooking && (
          <div className="grid gap-2">
            <Label htmlFor={`${uid}-doctorId`}>Preferred Doctor</Label>
            <Select name="doctorId" required value={doctorId} onValueChange={setDoctorId}>
              <SelectTrigger id={`${uid}-doctorId`} className="w-full">
                <SelectValue placeholder="Select doctor" />
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

      {isBlockDoctor && !isServiceBooking && (
        <p className="rounded-lg border border-dashed bg-muted/40 p-3 text-sm text-muted-foreground">
          This will register the patient into the current time block for {selectedDoctor?.specialty}.
        </p>
      )}

      {isServiceBooking && selectedService && (
        <p className="rounded-lg border border-dashed bg-muted/40 p-3 text-sm text-muted-foreground">
          This will register the patient into the current time block for {selectedService.specialty}.
        </p>
      )}

      {isServiceBooking && (
        <>
          <div className="grid gap-2">
            <Label htmlFor={`${uid}-clinicServiceId`}>Lab Test / Service</Label>
            <Select
              name="clinicServiceId"
              required
              value={clinicServiceId}
              onValueChange={setClinicServiceId}
            >
              <SelectTrigger id={`${uid}-clinicServiceId`} className="w-full">
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

      <div className="grid gap-2">
        <Label htmlFor={`${uid}-reason`}>Reason for Visit</Label>
        <Textarea
          id={`${uid}-reason`}
          name="reason"
          placeholder="Brief description of symptoms or visit reason..."
          rows={3}
        />
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending} className="w-full" size="lg">
        {existingPatient ? "Register Walk-in" : "Register & Check In"}
      </Button>
    </form>
  );
}

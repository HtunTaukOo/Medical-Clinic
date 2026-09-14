"use client";

import { useActionState, useState } from "react";
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
}: {
  doctors: { id: string; name: string; specialty: string | null }[];
  bookByServiceSpecialties: string[];
  blockCapacitySpecialties: string[];
  clinicServices: { id: string; name: string; specialty: string | null }[];
}) {
  const [state, formAction, pending] = useActionState<RegisterAndCheckInState, FormData>(
    registerAndCheckIn,
    {}
  );
  const [doctorId, setDoctorId] = useState("");
  const selectedDoctor = doctors.find((d) => d.id === doctorId);
  const needsService = !!selectedDoctor?.specialty && bookByServiceSpecialties.includes(selectedDoctor.specialty);
  const isBlockDoctor = !!selectedDoctor?.specialty && blockCapacitySpecialties.includes(selectedDoctor.specialty);
  const availableServices = clinicServices.filter((s) => s.specialty === selectedDoctor?.specialty);

  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="name">Full Name</Label>
        <Input id="name" name="name" placeholder="e.g. Ko Tun Aung" required />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="phone">Phone Number</Label>
          <Input id="phone" name="phone" placeholder="09 420000000" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="dob">Date of Birth</Label>
          <Input id="dob" name="dob" type="date" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="gender">Gender</Label>
          <Select name="gender">
            <SelectTrigger id="gender" className="w-full">
              <SelectValue placeholder="Select gender" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MALE">Male</SelectItem>
              <SelectItem value="FEMALE">Female</SelectItem>
              <SelectItem value="OTHER">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="doctorId">Preferred Doctor</Label>
          <Select name="doctorId" required value={doctorId} onValueChange={setDoctorId}>
            <SelectTrigger id="doctorId" className="w-full">
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

      <div className="grid gap-2">
        <Label htmlFor="reason">Reason for Visit</Label>
        <Textarea
          id="reason"
          name="reason"
          placeholder="Brief description of symptoms or visit reason..."
          rows={3}
        />
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending} className="w-full" size="lg">
        Register & Check In
      </Button>
    </form>
  );
}

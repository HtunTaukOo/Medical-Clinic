"use client";

import { useActionState } from "react";
import { updateOwnPersonalInfo, type UpdateOwnPersonalInfoState } from "@/actions/staff";
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

const FIELD_LABEL = "text-xs font-semibold tracking-wide text-muted-foreground uppercase";

export function DoctorPersonalInfoForm({
  name,
  email,
  dob,
  gender,
  phone,
  address,
  nrcNumber,
  emergencyContact,
}: {
  name: string;
  email: string;
  dob: string;
  gender: string;
  phone: string;
  address: string;
  nrcNumber: string;
  emergencyContact: string;
}) {
  const [state, formAction, pending] = useActionState<UpdateOwnPersonalInfoState, FormData>(
    updateOwnPersonalInfo,
    {}
  );

  return (
    <form action={formAction} className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="name" className={FIELD_LABEL}>
            Full Name
          </Label>
          <Input id="name" name="name" defaultValue={name} required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="dob" className={FIELD_LABEL}>
            Date of Birth
          </Label>
          <Input id="dob" name="dob" type="date" defaultValue={dob} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="gender" className={FIELD_LABEL}>
            Gender
          </Label>
          <Select name="gender" defaultValue={gender || undefined}>
            <SelectTrigger id="gender" className="w-full">
              <SelectValue placeholder="Select gender..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MALE">Male</SelectItem>
              <SelectItem value="FEMALE">Female</SelectItem>
              <SelectItem value="OTHER">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="phone" className={FIELD_LABEL}>
            Phone
          </Label>
          <Input id="phone" name="phone" defaultValue={phone} placeholder="09 987654321" />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="email" className={FIELD_LABEL}>
          Email Address
        </Label>
        <Input id="email" value={email} disabled />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="address" className={FIELD_LABEL}>
          Home Address
        </Label>
        <Input id="address" name="address" defaultValue={address} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="nrcNumber" className={FIELD_LABEL}>
            NRC / ID
          </Label>
          <Input id="nrcNumber" name="nrcNumber" defaultValue={nrcNumber} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="emergencyContact" className={FIELD_LABEL}>
            Emergency Contact
          </Label>
          <Input
            id="emergencyContact"
            name="emergencyContact"
            defaultValue={emergencyContact}
            placeholder="Name · Phone"
          />
        </div>
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && <p className="text-sm text-blue-600">Saved.</p>}

      <Button type="submit" disabled={pending} className="w-fit justify-self-end">
        Save Changes
      </Button>
    </form>
  );
}

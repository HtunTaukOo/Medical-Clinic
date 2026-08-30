"use client";

import { useActionState, useState } from "react";
import { updatePersonalDetails, type PatientFormState } from "@/actions/patients";
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

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export function PersonalDetailsForm({
  defaultValues,
}: {
  defaultValues: {
    name: string;
    gender: string;
    email: string;
    phone: string;
    dob: string;
    address: string;
    bloodType: string;
    nationality: string;
    nrcNumber: string;
    heightCm: string;
    weightKg: string;
  };
}) {
  const [state, formAction, pending] = useActionState<PatientFormState, FormData>(
    updatePersonalDetails,
    {}
  );
  const [heightCm, setHeightCm] = useState(defaultValues.heightCm);
  const [weightKg, setWeightKg] = useState(defaultValues.weightKg);

  const h = Number(heightCm);
  const w = Number(weightKg);
  const bmi = h > 0 && w > 0 ? (w / (h / 100) ** 2).toFixed(1) : null;

  return (
    <form action={formAction} className="grid gap-4">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Personal Information
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="name">Full Name</Label>
          <Input id="name" name="name" required defaultValue={defaultValues.name} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="dob">Date of Birth</Label>
          <Input id="dob" name="dob" type="date" defaultValue={defaultValues.dob} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="gender">Gender</Label>
          <Select name="gender" defaultValue={defaultValues.gender || "UNSPECIFIED"}>
            <SelectTrigger id="gender" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="UNSPECIFIED">Not specified</SelectItem>
              <SelectItem value="MALE">Male</SelectItem>
              <SelectItem value="FEMALE">Female</SelectItem>
              <SelectItem value="OTHER">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="bloodType">Blood Type</Label>
          <Select name="bloodType" defaultValue={defaultValues.bloodType || "UNSPECIFIED"}>
            <SelectTrigger id="bloodType" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="UNSPECIFIED">Not specified</SelectItem>
              {BLOOD_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="phone">Phone Number</Label>
          <Input id="phone" name="phone" defaultValue={defaultValues.phone} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="email">Email Address</Label>
          <Input id="email" name="email" type="email" defaultValue={defaultValues.email} />
        </div>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="address">Home Address</Label>
          <Input id="address" name="address" defaultValue={defaultValues.address} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="nationality">Nationality</Label>
          <Input id="nationality" name="nationality" defaultValue={defaultValues.nationality} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="nrcNumber">NRC / ID Number</Label>
          <Input id="nrcNumber" name="nrcNumber" defaultValue={defaultValues.nrcNumber} />
        </div>
      </div>

      <p className="mt-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Health Basics
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="heightCm">Height (cm)</Label>
          <Input
            id="heightCm"
            name="heightCm"
            type="number"
            step="0.1"
            value={heightCm}
            onChange={(e) => setHeightCm(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="weightKg">Weight (kg)</Label>
          <Input
            id="weightKg"
            name="weightKg"
            type="number"
            step="0.1"
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="bmi">BMI</Label>
          <Input id="bmi" value={bmi ?? ""} placeholder="—" disabled />
          <p className="text-xs text-muted-foreground">Auto-calculated</p>
        </div>
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && <p className="text-sm text-muted-foreground">Saved.</p>}
      <Button type="submit" disabled={pending} className="w-fit">
        Save Changes
      </Button>
    </form>
  );
}

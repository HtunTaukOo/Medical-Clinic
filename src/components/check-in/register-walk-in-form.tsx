"use client";

import { useActionState } from "react";
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
}: {
  doctors: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState<RegisterAndCheckInState, FormData>(
    registerAndCheckIn,
    {}
  );

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
          <Select name="doctorId" required>
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

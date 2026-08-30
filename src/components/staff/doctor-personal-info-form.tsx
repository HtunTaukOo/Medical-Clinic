"use client";

import { useActionState } from "react";
import { updateOwnName, type UpdateOwnNameState } from "@/actions/staff";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DoctorPersonalInfoForm({
  name,
  email,
}: {
  name: string;
  email: string;
}) {
  const [state, formAction, pending] = useActionState<UpdateOwnNameState, FormData>(
    updateOwnName,
    {}
  );

  return (
    <form action={formAction} className="grid max-w-md gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="name">Full name</Label>
        <Input id="name" name="name" defaultValue={name} required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" value={email} disabled />
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && <p className="text-sm text-emerald-600">Saved.</p>}
      <Button type="submit" disabled={pending} className="w-fit">
        Save
      </Button>
    </form>
  );
}

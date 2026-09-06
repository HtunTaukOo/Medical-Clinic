"use client";

import { useActionState } from "react";
import { updateOwnStaffPersonalInfo, type UpdateOwnStaffPersonalInfoState } from "@/actions/staff";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const FIELD_LABEL = "text-xs font-semibold tracking-wide text-muted-foreground uppercase";

export function StaffPersonalInfoForm({
  name,
  email,
  phone,
  roleLabel,
}: {
  name: string;
  email: string;
  phone: string;
  roleLabel: string;
}) {
  const [state, formAction, pending] = useActionState<UpdateOwnStaffPersonalInfoState, FormData>(
    updateOwnStaffPersonalInfo,
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
          <Label htmlFor="role" className={FIELD_LABEL}>
            Role
          </Label>
          <Input id="role" value={roleLabel} disabled />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="email" className={FIELD_LABEL}>
            Email
          </Label>
          <Input id="email" value={email} disabled />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="phone" className={FIELD_LABEL}>
            Phone
          </Label>
          <Input id="phone" name="phone" defaultValue={phone} placeholder="09 987654321" />
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

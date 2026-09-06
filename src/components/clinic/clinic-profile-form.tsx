"use client";

import { useActionState, useState } from "react";
import { updateClinicProfile, type ClinicSettingsFormState } from "@/actions/clinic-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChipListInput } from "@/components/staff/chip-list-input";
import { initials } from "@/lib/format";

export function ClinicProfileForm({
  name,
  email,
  address,
  phones,
  hasLogo,
}: {
  name: string;
  email: string | null;
  address: string | null;
  phones: string[];
  hasLogo: boolean;
}) {
  const [state, formAction, pending] = useActionState<ClinicSettingsFormState, FormData>(
    updateClinicProfile,
    {}
  );
  const [preview, setPreview] = useState<string | null>(null);

  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="name" className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Clinic Name
          </Label>
          <Input id="name" name="name" defaultValue={name} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="email" className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Email
          </Label>
          <Input id="email" name="email" type="email" defaultValue={email ?? ""} />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="address" className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Address
        </Label>
        <Input id="address" name="address" defaultValue={address ?? ""} />
      </div>

      <div className="grid gap-2">
        <Label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Phone Numbers
        </Label>
        <ChipListInput name="phones" defaultValues={phones} placeholder="+ Add phone number" />
      </div>

      <div className="grid gap-2">
        <Label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Logo</Label>
        <div className="flex items-center gap-3">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="size-14 rounded-lg object-cover" />
          ) : hasLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/api/clinic-settings/logo" alt="" className="size-14 rounded-lg object-cover" />
          ) : (
            <div className="flex size-14 items-center justify-center rounded-lg bg-primary/10 font-semibold text-primary">
              {initials(name)}
            </div>
          )}
          <Label
            htmlFor="logo"
            className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-input px-3 text-sm font-medium hover:bg-muted"
          >
            Upload Logo
          </Label>
          <input
            id="logo"
            name="logo"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              setPreview(file ? URL.createObjectURL(file) : null);
            }}
          />
        </div>
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && <p className="text-sm text-primary">Saved.</p>}

      <Button type="submit" disabled={pending} className="w-fit justify-self-end">
        Save Changes
      </Button>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { AlertTriangle } from "lucide-react";
import { updateEmergencyContact, type PatientFormState } from "@/actions/patients";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function EmergencyContactForm({
  defaultValues,
}: {
  defaultValues: {
    emergencyContactName: string;
    emergencyContactRelationship: string;
    emergencyContactPhone: string;
    emergencyContactAltPhone: string;
    emergencyContactAddress: string;
  };
}) {
  const [state, formAction, pending] = useActionState<PatientFormState, FormData>(
    updateEmergencyContact,
    {}
  );

  return (
    <form action={formAction} className="grid gap-4">
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <p>
          This person will be contacted in case of a medical emergency. Please keep this
          information up to date.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="emergencyContactName">Contact Name</Label>
          <Input
            id="emergencyContactName"
            name="emergencyContactName"
            defaultValue={defaultValues.emergencyContactName}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="emergencyContactRelationship">Relationship</Label>
          <Input
            id="emergencyContactRelationship"
            name="emergencyContactRelationship"
            defaultValue={defaultValues.emergencyContactRelationship}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="emergencyContactPhone">Phone Number</Label>
          <Input
            id="emergencyContactPhone"
            name="emergencyContactPhone"
            defaultValue={defaultValues.emergencyContactPhone}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="emergencyContactAltPhone">Alternate Phone</Label>
          <Input
            id="emergencyContactAltPhone"
            name="emergencyContactAltPhone"
            defaultValue={defaultValues.emergencyContactAltPhone}
          />
        </div>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="emergencyContactAddress">Address</Label>
          <Input
            id="emergencyContactAddress"
            name="emergencyContactAddress"
            defaultValue={defaultValues.emergencyContactAddress}
          />
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

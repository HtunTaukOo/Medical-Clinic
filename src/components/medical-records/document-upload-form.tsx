"use client";

import { useActionState } from "react";
import {
  uploadMedicalDocument,
  type MedicalRecordFormState,
} from "@/actions/medical-records";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DocumentUploadForm({ patientId }: { patientId: string }) {
  const boundAction = uploadMedicalDocument.bind(null, patientId);
  const [state, formAction, pending] = useActionState<
    MedicalRecordFormState,
    FormData
  >(boundAction, {});

  return (
    <form action={formAction} className="grid max-w-md gap-3">
      <div className="grid gap-2">
        <Label htmlFor="file">Document</Label>
        <Input id="file" name="file" type="file" required accept=".pdf,.png,.jpg,.jpeg" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="note">Note (optional)</Label>
        <Input id="note" name="note" placeholder="e.g. Prior history from previous clinic" />
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && <p className="text-sm text-muted-foreground">Uploaded.</p>}
      <Button type="submit" disabled={pending} className="w-fit">
        Upload document
      </Button>
    </form>
  );
}

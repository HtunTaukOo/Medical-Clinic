"use client";

import { useActionState } from "react";
import { addMedicalNote, type MedicalRecordFormState } from "@/actions/medical-records";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function NoteForm({ patientId }: { patientId: string }) {
  const boundAction = addMedicalNote.bind(null, patientId);
  const [state, formAction, pending] = useActionState<
    MedicalRecordFormState,
    FormData
  >(boundAction, {});

  return (
    <form action={formAction} className="grid gap-2">
      <Textarea
        name="note"
        required
        placeholder="Diagnosis, treatment plan, instructions for the pharmacist..."
      />
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending} className="w-fit">
        Add note
      </Button>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { deletePatient, type DeletePatientState } from "@/actions/patients";

export function DeletePatientButton({ patientId, name }: { patientId: string; name: string }) {
  const [state, formAction, pending] = useActionState<DeletePatientState, FormData>(
    deletePatient.bind(null, patientId),
    {}
  );

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm(`Delete ${name}'s patient record? This can't be undone.`)) e.preventDefault();
      }}
      className="inline-grid justify-items-end gap-1"
    >
      <button
        type="submit"
        disabled={pending}
        className="font-medium text-destructive underline underline-offset-2 disabled:opacity-50"
      >
        Delete
      </button>
      {state.error && <p className="max-w-48 text-right text-xs text-destructive">{state.error}</p>}
    </form>
  );
}

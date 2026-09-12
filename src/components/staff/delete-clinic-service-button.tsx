"use client";

import { useActionState } from "react";
import { deleteClinicService } from "@/actions/clinic-services";
import type { ClinicServiceFormState } from "@/actions/clinic-services";

export function DeleteClinicServiceButton({ serviceId, name }: { serviceId: string; name: string }) {
  const [state, formAction, pending] = useActionState<ClinicServiceFormState, FormData>(
    deleteClinicService.bind(null, serviceId),
    {}
  );

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm(`Delete "${name}"? This can't be undone.`)) e.preventDefault();
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

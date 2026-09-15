"use client";

import { useActionState } from "react";
import { deleteLabTest } from "@/actions/lab";
import type { LabTestFormState } from "@/actions/lab";

export function DeleteLabTestButton({ testId, name }: { testId: string; name: string }) {
  const [state, formAction, pending] = useActionState<LabTestFormState, FormData>(
    deleteLabTest.bind(null, testId),
    {}
  );

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm(`Delete "${name}"? This can't be undone.`)) e.preventDefault();
      }}
      className="grid justify-items-end gap-1"
    >
      <button
        type="submit"
        disabled={pending}
        className="text-sm font-medium text-destructive underline underline-offset-2 disabled:opacity-50"
      >
        Delete
      </button>
      {state.error && <p className="max-w-48 text-right text-xs text-destructive">{state.error}</p>}
    </form>
  );
}

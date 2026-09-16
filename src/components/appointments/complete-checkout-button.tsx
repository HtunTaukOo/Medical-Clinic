"use client";

import { useActionState } from "react";
import { completeAppointmentCheckout } from "@/actions/appointments";
import type { CompleteCheckoutState } from "@/actions/appointments";

export function CompleteCheckoutButton({ appointmentId }: { appointmentId: string }) {
  const [state, formAction, pending] = useActionState<CompleteCheckoutState, FormData>(
    completeAppointmentCheckout.bind(null, appointmentId),
    {}
  );

  return (
    <form action={formAction} className="inline-grid justify-items-end gap-1">
      <button
        type="submit"
        disabled={pending}
        className="font-medium text-emerald-600 underline underline-offset-2 disabled:opacity-50"
      >
        Complete
      </button>
      {state.error && <p className="max-w-48 text-right text-xs text-destructive">{state.error}</p>}
    </form>
  );
}

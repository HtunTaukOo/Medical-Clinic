"use client";

import { useActionState } from "react";
import { orderLabTests, type OrderLabTestsState } from "@/actions/lab";
import { Button } from "@/components/ui/button";

export function OrderLabTestsForm({
  appointmentId,
  tests,
}: {
  appointmentId: string;
  tests: { id: string; name: string; price: number }[];
}) {
  const boundAction = orderLabTests.bind(null, appointmentId);
  const [state, formAction, pending] = useActionState<OrderLabTestsState, FormData>(
    boundAction,
    {}
  );

  return (
    <form action={formAction} className="grid gap-3">
      <div className="grid gap-2">
        {tests.map((test) => (
          <label key={test.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="testIds" value={test.id} className="size-4" />
            {test.name} — {test.price.toFixed(2)}
          </label>
        ))}
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending} className="w-fit">
        Order tests
      </Button>
    </form>
  );
}

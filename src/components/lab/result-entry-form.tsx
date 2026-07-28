"use client";

import { useActionState } from "react";
import { enterResults, type EnterResultsState } from "@/actions/lab";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Item = {
  id: string;
  labTest: { name: string; unit: string | null; normalRange: string | null };
};

export function ResultEntryForm({
  labOrderId,
  items,
}: {
  labOrderId: string;
  items: Item[];
}) {
  const boundAction = enterResults.bind(null, labOrderId);
  const [state, formAction, pending] = useActionState<EnterResultsState, FormData>(
    boundAction,
    {}
  );

  return (
    <form action={formAction} className="grid gap-6">
      {items.map((item) => (
        <div key={item.id} className="grid gap-2 rounded-md border p-3">
          <p className="font-medium">{item.labTest.name}</p>
          {item.labTest.normalRange && (
            <p className="text-sm text-muted-foreground">
              Normal range: {item.labTest.normalRange}
              {item.labTest.unit && ` ${item.labTest.unit}`}
            </p>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-1">
              <Label htmlFor={`result-${item.id}`}>Result value</Label>
              <Input
                id={`result-${item.id}`}
                name={`result-${item.id}`}
                placeholder={item.labTest.unit ?? "Value"}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor={`note-${item.id}`}>Note (optional)</Label>
              <Input id={`note-${item.id}`} name={`note-${item.id}`} />
            </div>
          </div>
        </div>
      ))}
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending} className="w-fit">
        Save results
      </Button>
    </form>
  );
}

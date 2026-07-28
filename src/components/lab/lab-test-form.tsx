"use client";

import { useActionState, useEffect } from "react";
import { createLabTest, type LabTestFormState } from "@/actions/lab";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LabTestForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<LabTestFormState, FormData>(
    createLabTest,
    {}
  );

  useEffect(() => {
    if (state.success) router.push("/staff/lab");
  }, [state.success, router]);

  return (
    <form action={formAction} className="grid max-w-md gap-4">
      <div className="grid gap-2">
        <Label htmlFor="name">Test name</Label>
        <Input id="name" name="name" required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="unit">Unit</Label>
        <Input id="unit" name="unit" placeholder="e.g. mg/dL" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="normalRange">Normal range</Label>
        <Input id="normalRange" name="normalRange" placeholder="e.g. 70–100" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="price">Price</Label>
        <Input id="price" name="price" type="number" min={0} step="0.01" required />
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending} className="w-fit">
        Create test
      </Button>
    </form>
  );
}

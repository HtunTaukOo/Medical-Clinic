"use client";

import { useActionState, useEffect, useState } from "react";
import { createLabTest, updateLabTest, type LabTestFormState } from "@/actions/lab";
import { useRouter } from "@/i18n/navigation";
import { LAB_TEST_CATEGORIES, LAB_TEST_CATEGORY_LABELS } from "@/lib/lab-categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ExistingTest = {
  id: string;
  name: string;
  unit: string | null;
  normalRange: string | null;
  price: number;
  category: (typeof LAB_TEST_CATEGORIES)[number];
  requiresExternalLab: boolean;
};

export function LabTestForm({ test }: { test?: ExistingTest }) {
  const router = useRouter();
  const action = test ? updateLabTest.bind(null, test.id) : createLabTest;
  const [state, formAction, pending] = useActionState<LabTestFormState, FormData>(action, {});
  const [category, setCategory] = useState<string>(test?.category ?? "GENERAL_HEALTH");

  useEffect(() => {
    if (state.success) router.push("/staff/lab?tab=catalog");
  }, [state.success, router]);

  return (
    <form action={formAction} className="grid max-w-md gap-4">
      <div className="grid gap-2">
        <Label htmlFor="name">Test name</Label>
        <Input id="name" name="name" defaultValue={test?.name} required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="category">Category</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger id="category" className="w-full">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {LAB_TEST_CATEGORIES.map((key) => (
              <SelectItem key={key} value={key}>
                {LAB_TEST_CATEGORY_LABELS[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input type="hidden" name="category" value={category} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="unit">Unit</Label>
        <Input id="unit" name="unit" defaultValue={test?.unit ?? undefined} placeholder="e.g. mg/dL" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="normalRange">Normal range</Label>
        <Input
          id="normalRange"
          name="normalRange"
          defaultValue={test?.normalRange ?? undefined}
          placeholder="e.g. 70–100"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="price">Price</Label>
        <Input
          id="price"
          name="price"
          type="number"
          min={0}
          step="0.01"
          defaultValue={test?.price}
          required
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="requiresExternalLab"
          defaultChecked={test?.requiresExternalLab ?? false}
          className="size-4"
        />
        Requires sending to an external lab
      </label>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending} className="w-fit">
        {test ? "Save changes" : "Create test"}
      </Button>
    </form>
  );
}

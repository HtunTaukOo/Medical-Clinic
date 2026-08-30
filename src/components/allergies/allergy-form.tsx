"use client";

import { useActionState } from "react";
import type { AllergyFormState } from "@/actions/allergies";
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

export function AllergyForm({
  action,
}: {
  action: (state: AllergyFormState, formData: FormData) => Promise<AllergyFormState>;
}) {
  const [state, formAction, pending] = useActionState<AllergyFormState, FormData>(
    action,
    {}
  );

  return (
    <form
      action={formAction}
      key={state.success ? "reset" : "form"}
      className="grid gap-3 sm:grid-cols-2"
    >
      <div className="grid gap-1.5">
        <Label htmlFor="allergy-name">Allergen</Label>
        <Input id="allergy-name" name="name" required placeholder="e.g. Penicillin" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="allergy-category">Category</Label>
        <Select name="category" defaultValue="OTHER">
          <SelectTrigger id="allergy-category" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="DRUG">Drug</SelectItem>
            <SelectItem value="FOOD">Food</SelectItem>
            <SelectItem value="ENVIRONMENTAL">Environmental</SelectItem>
            <SelectItem value="OTHER">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="allergy-reaction">Reaction (optional)</Label>
        <Input id="allergy-reaction" name="reaction" placeholder="e.g. Hives, Anaphylaxis" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="allergy-severity">Severity</Label>
        <Select name="severity" defaultValue="MILD">
          <SelectTrigger id="allergy-severity" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="MILD">Mild</SelectItem>
            <SelectItem value="MODERATE">Moderate</SelectItem>
            <SelectItem value="SEVERE">Severe</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="allergy-first-noted">First noted (optional)</Label>
        <Input id="allergy-first-noted" name="firstNoted" type="date" />
      </div>
      {state.error && <p className="text-sm text-destructive sm:col-span-2">{state.error}</p>}
      <Button type="submit" disabled={pending} className="w-fit sm:col-span-2">
        Add allergy
      </Button>
    </form>
  );
}

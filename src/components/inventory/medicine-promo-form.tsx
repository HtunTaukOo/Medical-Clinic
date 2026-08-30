"use client";

import { useActionState, useState } from "react";
import { updateMedicinePromo, type MedicinePromoState } from "@/actions/inventory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const PROMO_CATEGORIES = [
  "Cardiology",
  "Supplement",
  "Gastro",
  "Diabetes",
  "Pain Relief",
  "General",
];

export function MedicinePromoForm({
  medicineId,
  featured,
  brand,
  category,
  description,
}: {
  medicineId: string;
  featured: boolean;
  brand: string | null;
  category: string | null;
  description: string | null;
}) {
  const boundAction = updateMedicinePromo.bind(null, medicineId);
  const [state, formAction, pending] = useActionState<MedicinePromoState, FormData>(
    boundAction,
    {}
  );
  const [isFeatured, setIsFeatured] = useState(featured);

  return (
    <form action={formAction} className="grid gap-3">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          name="featured"
          checked={isFeatured}
          onChange={(e) => setIsFeatured(e.target.checked)}
        />
        Feature in the &quot;From the Pharmacy&quot; section of the patient portal
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor={`brand-${medicineId}`}>Brand</Label>
          <Input id={`brand-${medicineId}`} name="brand" defaultValue={brand ?? ""} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`category-${medicineId}`}>Category</Label>
          <Input
            id={`category-${medicineId}`}
            name="category"
            list={`promo-categories-${medicineId}`}
            defaultValue={category ?? ""}
          />
          <datalist id={`promo-categories-${medicineId}`}>
            {PROMO_CATEGORIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`description-${medicineId}`}>Description</Label>
        <Textarea
          id={`description-${medicineId}`}
          name="description"
          rows={2}
          defaultValue={description ?? ""}
        />
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && <p className="text-sm text-muted-foreground">Saved.</p>}
      <Button type="submit" disabled={pending} className="w-fit" size="sm">
        Save
      </Button>
    </form>
  );
}

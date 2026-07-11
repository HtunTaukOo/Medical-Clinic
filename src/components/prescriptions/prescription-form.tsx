"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import type { PrescriptionFormState } from "@/actions/prescriptions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Row = { medicineId: string; dosage: string; quantity: string };

export function PrescriptionForm({
  action,
  medicines,
}: {
  action: (
    state: PrescriptionFormState,
    formData: FormData
  ) => Promise<PrescriptionFormState>;
  medicines: { id: string; name: string; unit: string }[];
}) {
  const t = useTranslations("appointments");
  const [rows, setRows] = useState<Row[]>([
    { medicineId: "", dosage: "", quantity: "1" },
  ]);
  const [state, formAction, pending] = useActionState<
    PrescriptionFormState,
    FormData
  >(action, {});

  function updateRow(index: number, patch: Partial<Row>) {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );
  }

  function handleSubmit(formData: FormData) {
    formData.set("items", JSON.stringify(rows));
    return formAction(formData);
  }

  return (
    <form action={handleSubmit} className="grid max-w-2xl gap-4">
      <div className="grid gap-3">
        {rows.map((row, index) => (
          <div key={index} className="flex flex-wrap items-end gap-2">
            <div className="min-w-48">
              <Select
                value={row.medicineId}
                onValueChange={(value) => updateRow(index, { medicineId: value })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("addMedicine")} />
                </SelectTrigger>
                <SelectContent>
                  {medicines.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name} ({m.unit})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input
              placeholder="Dosage"
              value={row.dosage}
              onChange={(e) => updateRow(index, { dosage: e.target.value })}
              className="w-40"
            />
            <Input
              type="number"
              min={1}
              value={row.quantity}
              onChange={(e) => updateRow(index, { quantity: e.target.value })}
              className="w-24"
            />
            {rows.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  setRows((prev) => prev.filter((_, i) => i !== index))
                }
              >
                Remove
              </Button>
            )}
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={() =>
            setRows((prev) => [
              ...prev,
              { medicineId: "", dosage: "", quantity: "1" },
            ])
          }
        >
          {t("addMedicine")}
        </Button>
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && (
        <p className="text-sm text-muted-foreground">Prescription saved.</p>
      )}
      <Button type="submit" disabled={pending} className="w-fit">
        {t("writePrescription")}
      </Button>
    </form>
  );
}

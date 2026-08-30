"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import type { PrescriptionFormState } from "@/actions/prescriptions";
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

type Row = {
  medicineId: string;
  dosage: string;
  quantity: string;
  timesPerDay: string;
  durationDays: string;
  frequency: string;
  instructions: string;
  refillsLeft: string;
};

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
    {
      medicineId: "",
      dosage: "",
      quantity: "1",
      timesPerDay: "",
      durationDays: "",
      frequency: "",
      instructions: "",
      refillsLeft: "",
    },
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
    const items = rows.map((row) => ({
      medicineId: row.medicineId,
      dosage: row.dosage,
      quantity: row.quantity,
      timesPerDay: row.timesPerDay || undefined,
      durationDays: row.durationDays || undefined,
      frequency: row.frequency || undefined,
      instructions: row.instructions || undefined,
      refillsLeft: row.refillsLeft || undefined,
    }));
    formData.set("items", JSON.stringify(items));
    return formAction(formData);
  }

  return (
    <form action={handleSubmit} className="grid max-w-2xl gap-4">
      <div className="grid gap-4">
        {rows.map((row, index) => (
          <div key={index} className="grid gap-2 rounded-md border p-3">
            <div className="flex flex-wrap items-end gap-2">
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
            <div className="flex flex-wrap items-end gap-2">
              <div className="grid gap-1">
                <Label className="text-xs text-muted-foreground">
                  Reminders: times/day
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={8}
                  placeholder="e.g. 3"
                  value={row.timesPerDay}
                  onChange={(e) => updateRow(index, { timesPerDay: e.target.value })}
                  className="w-24"
                />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs text-muted-foreground">
                  For how many days
                </Label>
                <Input
                  type="number"
                  min={1}
                  placeholder="e.g. 5"
                  value={row.durationDays}
                  onChange={(e) => updateRow(index, { durationDays: e.target.value })}
                  className="w-24"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Optional — sends Telegram reminders to the patient once fulfilled
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="grid min-w-44 gap-1">
                <Label className="text-xs text-muted-foreground">Frequency (shown to patient)</Label>
                <Input
                  placeholder="e.g. 1 tablet daily"
                  value={row.frequency}
                  onChange={(e) => updateRow(index, { frequency: e.target.value })}
                />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs text-muted-foreground">Refills</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="e.g. 2"
                  value={row.refillsLeft}
                  onChange={(e) => updateRow(index, { refillsLeft: e.target.value })}
                  className="w-24"
                />
              </div>
              <div className="grid min-w-52 flex-1 gap-1">
                <Label className="text-xs text-muted-foreground">Instructions (optional)</Label>
                <Input
                  placeholder="e.g. Take with food"
                  value={row.instructions}
                  onChange={(e) => updateRow(index, { instructions: e.target.value })}
                />
              </div>
            </div>
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
              {
                medicineId: "",
                dosage: "",
                quantity: "1",
                timesPerDay: "",
                durationDays: "",
                frequency: "",
                instructions: "",
                refillsLeft: "",
              },
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

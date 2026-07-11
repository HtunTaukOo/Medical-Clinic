"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { createInvoice, type InvoiceFormState } from "@/actions/billing";
import { useRouter } from "@/i18n/navigation";
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

type Row = { description: string; quantity: string; unitPrice: string };

export function InvoiceForm({
  patients,
  lockedPatient,
  appointmentId,
  redirectOnSuccess = "/staff/billing",
}: {
  patients?: { id: string; name: string }[];
  lockedPatient?: { id: string; name: string };
  appointmentId?: string;
  redirectOnSuccess?: string;
}) {
  const t = useTranslations("billing");
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([
    { description: "", quantity: "1", unitPrice: "0" },
  ]);
  const [state, formAction, pending] = useActionState<
    InvoiceFormState,
    FormData
  >(createInvoice, {});

  useEffect(() => {
    if (state.success) router.push(redirectOnSuccess);
  }, [state.success, redirectOnSuccess, router]);

  function updateRow(index: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function handleSubmit(formData: FormData) {
    formData.set("items", JSON.stringify(rows));
    return formAction(formData);
  }

  const total = rows.reduce(
    (sum, row) => sum + (Number(row.quantity) || 0) * (Number(row.unitPrice) || 0),
    0
  );

  return (
    <form action={handleSubmit} className="grid max-w-2xl gap-4">
      {appointmentId && <input type="hidden" name="appointmentId" value={appointmentId} />}
      {lockedPatient ? (
        <div className="grid gap-2">
          <Label>{t("patient")}</Label>
          <input type="hidden" name="patientId" value={lockedPatient.id} />
          <p className="font-medium">{lockedPatient.name}</p>
        </div>
      ) : (
        <div className="grid gap-2">
          <Label htmlFor="patientId">{t("patient")}</Label>
          <Select name="patientId" required>
            <SelectTrigger id="patientId" className="w-full">
              <SelectValue placeholder={t("patient")} />
            </SelectTrigger>
            <SelectContent>
              {patients?.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid gap-3">
        {rows.map((row, index) => (
          <div key={index} className="flex flex-wrap items-end gap-2">
            <Input
              placeholder={t("description")}
              value={row.description}
              onChange={(e) => updateRow(index, { description: e.target.value })}
              className="min-w-48 flex-1"
            />
            <div className="grid gap-1">
              <Label className="text-xs text-muted-foreground">{t("quantity")}</Label>
              <Input
                type="number"
                min={1}
                value={row.quantity}
                onChange={(e) => updateRow(index, { quantity: e.target.value })}
                className="w-20"
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs text-muted-foreground">{t("unitPrice")}</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={row.unitPrice}
                onChange={(e) => updateRow(index, { unitPrice: e.target.value })}
                className="w-28"
              />
            </div>
            {rows.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
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
            setRows((prev) => [...prev, { description: "", quantity: "1", unitPrice: "0" }])
          }
        >
          {t("addItem")}
        </Button>
      </div>

      <p className="text-lg font-semibold">
        {t("total")}: {total.toFixed(2)}
      </p>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending} className="w-fit">
        {t("newInvoice")}
      </Button>
    </form>
  );
}

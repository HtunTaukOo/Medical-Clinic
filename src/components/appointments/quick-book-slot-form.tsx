"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { createAppointment, type AppointmentFormState } from "@/actions/appointments";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DialogClose } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Only mounted while its owning dialog is open (Radix unmounts DialogContent
// when closed), so plain static ids are safe even with one of these per
// available cell on the schedule grid.
export function QuickBookSlotForm({
  doctorId,
  patients,
  timeLabel,
  blockDate,
  blockId,
  scheduledAt,
  defaultPatientId,
}: {
  doctorId: string;
  patients: { id: string; name: string }[];
  timeLabel: string;
  defaultPatientId?: string;
} & (
  | { blockDate: string; blockId: string; scheduledAt?: undefined }
  | { blockDate?: undefined; blockId?: undefined; scheduledAt: string }
)) {
  const t = useTranslations("appointments");
  const [state, formAction, pending] = useActionState<AppointmentFormState, FormData>(
    createAppointment,
    {}
  );

  if (state.success) {
    return (
      <div className="grid gap-4">
        <p className="text-sm text-emerald-600">{t("followUpBooked", { time: timeLabel })}</p>
        <DialogClose asChild>
          <Button className="w-full">{t("done")}</Button>
        </DialogClose>
      </div>
    );
  }

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="doctorId" value={doctorId} />
      {blockDate && blockId ? (
        <>
          <input type="hidden" name="blockDate" value={blockDate} />
          <input type="hidden" name="blockId" value={blockId} />
        </>
      ) : (
        <input type="hidden" name="scheduledAt" value={scheduledAt} />
      )}

      <p className="text-sm text-muted-foreground">{t("bookingFollowUp", { time: timeLabel })}</p>

      {patients.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("noExistingPatients")}
        </p>
      ) : (
        <div className="grid gap-2">
          <Label htmlFor="quick-book-patientId">{t("patient")}</Label>
          <Select name="patientId" required defaultValue={defaultPatientId}>
            <SelectTrigger id="quick-book-patientId" className="w-full">
              <SelectValue placeholder={t("selectPatient")} />
            </SelectTrigger>
            <SelectContent>
              {patients.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid gap-2">
        <Label htmlFor="quick-book-reason">{t("reason")}</Label>
        <Textarea
          id="quick-book-reason"
          name="reason"
          placeholder={t("followUpReasonPlaceholder")}
          rows={3}
        />
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending || patients.length === 0} className="w-full">
        {t("bookFollowUp")}
      </Button>
    </form>
  );
}

"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import {
  rescheduleAppointment,
  type RescheduleAppointmentState,
} from "@/actions/appointments";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function RescheduleDialog({
  appointmentId,
  patientName,
  trigger,
}: {
  appointmentId: string;
  patientName: string;
  trigger: React.ReactNode;
}) {
  const t = useTranslations("portal.reschedule");
  const [open, setOpen] = useState(false);
  const action = rescheduleAppointment.bind(null, appointmentId);
  const [state, formAction, pending] = useActionState<RescheduleAppointmentState, FormData>(
    action,
    {}
  );

  // Derived during render (not an effect): the dialog should close the
  // instant a reschedule succeeds, and comparing state references here
  // avoids the extra render + set-state-in-effect that a useEffect would add.
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state.success && open) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description", { patient: patientName })}</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor={`scheduledAt-${appointmentId}`}>{t("newDateTime")}</Label>
            <Input
              id={`scheduledAt-${appointmentId}`}
              name="scheduledAt"
              type="datetime-local"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`reason-${appointmentId}`}>{t("reasonOptional")}</Label>
            <Textarea
              id={`reason-${appointmentId}`}
              name="reason"
              placeholder={t("reasonPlaceholder")}
              rows={2}
            />
          </div>
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          <Button type="submit" disabled={pending} className="w-fit">
            {t("save")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

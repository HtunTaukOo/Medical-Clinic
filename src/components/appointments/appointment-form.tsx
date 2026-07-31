"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { AppointmentFormState } from "@/actions/appointments";
import { useRouter, Link } from "@/i18n/navigation";
import { JoinWaitlistForm } from "@/components/appointments/join-waitlist-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function AppointmentForm({
  action,
  patients,
  doctors,
  redirectOnSuccess,
  defaultDoctorId,
}: {
  action: (
    state: AppointmentFormState,
    formData: FormData
  ) => Promise<AppointmentFormState>;
  patients?: { id: string; name: string }[];
  doctors: { id: string; name: string; specialty: string | null }[];
  redirectOnSuccess: string;
  defaultDoctorId?: string;
}) {
  const t = useTranslations("appointments");
  const router = useRouter();
  const [state, formAction, pending] = useActionState<
    AppointmentFormState,
    FormData
  >(action, {});
  const [repeatWeekly, setRepeatWeekly] = useState(false);

  const isStaffBooking = !!patients;

  useEffect(() => {
    if (state.success && state.skippedDates === undefined) {
      router.push(redirectOnSuccess);
    }
  }, [state.success, state.skippedDates, redirectOnSuccess, router]);

  if (state.success && state.skippedDates !== undefined) {
    return (
      <div className="grid max-w-lg gap-3">
        <p className="text-sm text-emerald-600">
          Booked {state.createdCount} weekly appointment{state.createdCount === 1 ? "" : "s"}.
        </p>
        {state.skippedDates.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Skipped (conflict or leave day): {state.skippedDates.join(", ")}
          </p>
        )}
        <Button asChild size="sm" variant="outline" className="w-fit">
          <Link href={redirectOnSuccess}>Done</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid max-w-lg gap-4">
      <form action={formAction} className="grid gap-4">
      {patients && (
        <div className="grid gap-2">
          <Label htmlFor="patientId">{t("patient")}</Label>
          <Select name="patientId" required>
            <SelectTrigger id="patientId" className="w-full">
              <SelectValue placeholder={t("patient")} />
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
        <Label htmlFor="doctorId">{t("doctor")}</Label>
        <Select name="doctorId" required defaultValue={defaultDoctorId}>
          <SelectTrigger id="doctorId" className="w-full">
            <SelectValue placeholder={t("doctor")} />
          </SelectTrigger>
          <SelectContent>
            {doctors.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
                {d.specialty ? ` (${d.specialty})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="scheduledAt">{t("scheduledAt")}</Label>
        <Input
          id="scheduledAt"
          name="scheduledAt"
          type="datetime-local"
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="reason">{t("reason")}</Label>
        <Textarea id="reason" name="reason" />
      </div>

      {isStaffBooking && (
        <div className="grid gap-2 rounded-lg border p-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              name="repeatWeekly"
              checked={repeatWeekly}
              onChange={(e) => setRepeatWeekly(e.target.checked)}
            />
            Repeat weekly
          </label>
          {repeatWeekly && (
            <div className="grid gap-2">
              <Label htmlFor="occurrences">Number of occurrences</Label>
              <Input
                id="occurrences"
                name="occurrences"
                type="number"
                min={2}
                max={12}
                defaultValue={4}
              />
              <p className="text-xs text-muted-foreground">
                Any occurrence that conflicts or falls on a leave day is skipped rather than
                blocking the rest of the series.
              </p>
            </div>
          )}
        </div>
      )}

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {t("new")}
      </Button>
      </form>

      {!isStaffBooking && state.conflict && (
        <JoinWaitlistForm
          doctorId={state.conflict.doctorId}
          scheduledAt={state.conflict.scheduledAt}
          reason={state.conflict.reason}
        />
      )}
    </div>
  );
}

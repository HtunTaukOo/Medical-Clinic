"use client";

import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import type { AppointmentFormState } from "@/actions/appointments";
import { useRouter } from "@/i18n/navigation";
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

  useEffect(() => {
    if (state.success) {
      router.push(redirectOnSuccess);
    }
  }, [state.success, redirectOnSuccess, router]);

  return (
    <form action={formAction} className="grid max-w-lg gap-4">
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
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {t("new")}
      </Button>
    </form>
  );
}

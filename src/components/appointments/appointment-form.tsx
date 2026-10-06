"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { AppointmentFormState } from "@/actions/appointments";
import { useRouter, Link } from "@/i18n/navigation";
import { JoinWaitlistForm } from "@/components/appointments/join-waitlist-form";
import { BlockPicker } from "@/components/appointments/block-picker";
import { DoctorSlotPicker } from "@/components/appointments/doctor-slot-picker";
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
  blockSpecialties,
  serviceSpecialties,
  clinicServices,
  redirectOnSuccess,
  defaultDoctorId,
  defaultPatientId,
}: {
  action: (
    state: AppointmentFormState,
    formData: FormData
  ) => Promise<AppointmentFormState>;
  patients?: { id: string; name: string }[];
  doctors?: { id: string; name: string; specialty: string | null }[];
  blockSpecialties?: { name: string; capacityPerSlot: number }[];
  // SERVICE_CAPACITY specialties (e.g. Lab Visit) — no real doctor to pick,
  // so these render a service + shared-capacity time picker instead of the
  // doctor dropdown, and the doctor is auto-assigned server-side.
  serviceSpecialties?: { name: string; capacityPerSlot: number }[];
  clinicServices?: { id: string; name: string; specialty: string | null }[];
  redirectOnSuccess: string;
  defaultDoctorId?: string;
  defaultPatientId?: string;
}) {
  const t = useTranslations("appointments");
  const router = useRouter();
  const [state, formAction, pending] = useActionState<
    AppointmentFormState,
    FormData
  >(action, {});
  const [repeatWeekly, setRepeatWeekly] = useState(false);
  const [doctorId, setDoctorId] = useState(defaultDoctorId ?? "");
  const [bookingKind, setBookingKind] = useState<"doctor" | "service">("doctor");
  const [clinicServiceId, setClinicServiceId] = useState("");

  const isStaffBooking = !!patients;
  const selectedDoctor = doctors?.find((d) => d.id === doctorId);
  const blockSpecialty = blockSpecialties?.find((s) => s.name === selectedDoctor?.specialty) ?? null;

  const hasServiceOption = !!serviceSpecialties && serviceSpecialties.length > 0;
  const eligibleServices = (clinicServices ?? []).filter((s) =>
    serviceSpecialties?.some((sp) => sp.name === s.specialty)
  );
  const selectedService = eligibleServices.find((s) => s.id === clinicServiceId) ?? null;
  const selectedServiceSpecialty =
    serviceSpecialties?.find((sp) => sp.name === selectedService?.specialty) ?? null;
  const isServiceBooking = hasServiceOption && bookingKind === "service";

  useEffect(() => {
    if (state.success && state.skippedDates === undefined) {
      router.push(redirectOnSuccess);
    }
  }, [state.success, state.skippedDates, redirectOnSuccess, router]);

  if (state.success && state.skippedDates !== undefined) {
    return (
      <div className="grid max-w-lg gap-3">
        <p className="text-sm text-emerald-600">
          {t("weeklyBooked", { count: state.createdCount ?? 0 })}
        </p>
        {state.skippedDates.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {t("skippedDates", { dates: state.skippedDates.join(", ") })}
          </p>
        )}
        <Button asChild size="sm" variant="outline" className="w-fit">
          <Link href={redirectOnSuccess}>{t("done")}</Link>
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
          <Select name="patientId" required defaultValue={defaultPatientId}>
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
      {hasServiceOption && (
        <div className="grid gap-2">
          <Label>{t("bookingType")}</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={bookingKind === "doctor" ? "default" : "outline"}
              onClick={() => setBookingKind("doctor")}
            >
              {t("doctorConsultation")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={bookingKind === "service" ? "default" : "outline"}
              onClick={() => setBookingKind("service")}
            >
              {t("labVisitService")}
            </Button>
          </div>
        </div>
      )}

      {isServiceBooking ? (
        <>
          <div className="grid gap-2">
            <Label htmlFor="clinicServiceId">{t("service")}</Label>
            <Select
              name="clinicServiceId"
              required
              value={clinicServiceId}
              onValueChange={setClinicServiceId}
            >
              <SelectTrigger id="clinicServiceId" className="w-full">
                <SelectValue placeholder={t("selectService")} />
              </SelectTrigger>
              <SelectContent>
                {eligibleServices.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <input type="hidden" name="specialtyName" value={selectedService?.specialty ?? ""} />
          {selectedServiceSpecialty && (
            <BlockPicker
              specialtyName={selectedServiceSpecialty.name}
              capacityPerSlot={selectedServiceSpecialty.capacityPerSlot}
            />
          )}
        </>
      ) : (
        <>
          <div className="grid gap-2">
            <Label htmlFor="doctorId">{t("doctor")}</Label>
            <Select name="doctorId" required value={doctorId} onValueChange={setDoctorId}>
              <SelectTrigger id="doctorId" className="w-full">
                <SelectValue placeholder={t("doctor")} />
              </SelectTrigger>
              <SelectContent>
                {doctors?.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                    {d.specialty ? ` (${d.specialty})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {blockSpecialty ? (
            <BlockPicker
              specialtyName={blockSpecialty.name}
              capacityPerSlot={blockSpecialty.capacityPerSlot}
              doctorId={doctorId}
            />
          ) : (
            <DoctorSlotPicker doctorId={doctorId} />
          )}
        </>
      )}
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
            {t("repeatWeekly")}
          </label>
          {repeatWeekly && (
            <div className="grid gap-2">
              <Label htmlFor="occurrences">{t("numberOfOccurrences")}</Label>
              <Input
                id="occurrences"
                name="occurrences"
                type="number"
                min={2}
                max={12}
                defaultValue={4}
              />
              <p className="text-xs text-muted-foreground">
                {t("recurringBookingHelp")}
              </p>
            </div>
          )}
        </div>
      )}

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {t(isStaffBooking ? "new" : "requestNew")}
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

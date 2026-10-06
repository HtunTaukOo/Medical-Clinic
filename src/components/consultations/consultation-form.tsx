"use client";

import type { ReactNode } from "react";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { updateConsultation, type ConsultationFormState } from "@/actions/appointments";
import { SymptomPicker } from "@/components/consultations/symptom-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const CONSULTATION_FORM_ID = "consultation-form";

type Defaults = {
  bpSystolic: number | null;
  bpDiastolic: number | null;
  heartRateBpm: number | null;
  temperatureC: number | null;
  respiratoryRate: number | null;
  spo2Percent: number | null;
  weightKg: number | null;
  heightCm: number | null;
  chiefComplaint: string | null;
  symptoms: string[];
  physicalExam: string | null;
  clinicalNotes: string | null;
  treatmentPlan: string | null;
};

function SectionHeading({ number, title }: { number: number; title: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
        {number}
      </span>
      <h2 className="font-semibold">{title}</h2>
    </div>
  );
}

export function ConsultationForm({
  appointmentId,
  defaultValues,
  diagnosisSlot,
}: {
  appointmentId: string;
  defaultValues: Defaults;
  diagnosisSlot: ReactNode;
}) {
  const t = useTranslations("clinical");
  const boundAction = updateConsultation.bind(null, appointmentId);
  const [state, formAction] = useActionState<ConsultationFormState, FormData>(boundAction, {});

  return (
    <div className="grid gap-8">
      <form id={CONSULTATION_FORM_ID} action={formAction} className="hidden" aria-hidden />
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <SectionHeading number={1} title={t("vitalSigns")} />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="grid gap-1.5">
            <Label htmlFor="c-bp" className="text-xs tracking-wide text-muted-foreground uppercase">
              {t("bloodPressure")}
            </Label>
            <div className="flex items-center gap-1">
              <Input
                id="c-bp"
                name="bpSystolic"
                type="number"
                placeholder="120"
                defaultValue={defaultValues.bpSystolic ?? ""}
                form={CONSULTATION_FORM_ID}
              />
              <span className="text-muted-foreground">/</span>
              <Input
                name="bpDiastolic"
                type="number"
                placeholder="80"
                defaultValue={defaultValues.bpDiastolic ?? ""}
                form={CONSULTATION_FORM_ID}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="c-temp" className="text-xs tracking-wide text-muted-foreground uppercase">
              {t("temperature")}
            </Label>
            <Input
              id="c-temp"
              name="temperatureC"
              type="number"
              step="0.1"
              placeholder="e.g. 37.2"
              defaultValue={defaultValues.temperatureC ?? ""}
              form={CONSULTATION_FORM_ID}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="c-pulse" className="text-xs tracking-wide text-muted-foreground uppercase">
              {t("pulseRate")}
            </Label>
            <Input
              id="c-pulse"
              name="heartRateBpm"
              type="number"
              placeholder="e.g. 72"
              defaultValue={defaultValues.heartRateBpm ?? ""}
              form={CONSULTATION_FORM_ID}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="c-rr" className="text-xs tracking-wide text-muted-foreground uppercase">
              {t("respiratoryRate")}
            </Label>
            <Input
              id="c-rr"
              name="respiratoryRate"
              type="number"
              placeholder="e.g. 16"
              defaultValue={defaultValues.respiratoryRate ?? ""}
              form={CONSULTATION_FORM_ID}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="c-spo2" className="text-xs tracking-wide text-muted-foreground uppercase">
              SpO<sub>2</sub> (%)
            </Label>
            <Input
              id="c-spo2"
              name="spo2Percent"
              type="number"
              placeholder="e.g. 98"
              defaultValue={defaultValues.spo2Percent ?? ""}
              form={CONSULTATION_FORM_ID}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="c-weight" className="text-xs tracking-wide text-muted-foreground uppercase">
              {t("weight")}
            </Label>
            <Input
              id="c-weight"
              name="weightKg"
              type="number"
              step="0.1"
              placeholder="82"
              defaultValue={defaultValues.weightKg ?? ""}
              form={CONSULTATION_FORM_ID}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="c-height" className="text-xs tracking-wide text-muted-foreground uppercase">
              {t("height")}
            </Label>
            <Input
              id="c-height"
              name="heightCm"
              type="number"
              step="0.1"
              placeholder="170"
              defaultValue={defaultValues.heightCm ?? ""}
              form={CONSULTATION_FORM_ID}
            />
          </div>
        </div>
      </section>

      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <SectionHeading number={2} title={t("chiefComplaint")} />
        <Textarea
          name="chiefComplaint"
          rows={2}
          placeholder={t("chiefComplaintPlaceholder")}
          defaultValue={defaultValues.chiefComplaint ?? ""}
          form={CONSULTATION_FORM_ID}
        />
      </section>

      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <SectionHeading number={3} title={t("symptoms")} />
        <SymptomPicker formId={CONSULTATION_FORM_ID} defaultValues={defaultValues.symptoms} />
      </section>

      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <SectionHeading number={4} title={t("physicalExamination")} />
        <Textarea
          name="physicalExam"
          rows={3}
          placeholder={t("physicalExaminationPlaceholder")}
          defaultValue={defaultValues.physicalExam ?? ""}
          form={CONSULTATION_FORM_ID}
        />
      </section>

      {diagnosisSlot}

      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <SectionHeading number={6} title={t("clinicalNotes")} />
        <Textarea
          name="clinicalNotes"
          rows={3}
          placeholder={t("clinicalNotesPlaceholder")}
          defaultValue={defaultValues.clinicalNotes ?? ""}
          form={CONSULTATION_FORM_ID}
        />
      </section>

      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <SectionHeading number={7} title={t("treatmentPlan")} />
        <Textarea
          name="treatmentPlan"
          rows={3}
          placeholder={t("treatmentPlanPlaceholder")}
          defaultValue={defaultValues.treatmentPlan ?? ""}
          form={CONSULTATION_FORM_ID}
        />
      </section>
    </div>
  );
}

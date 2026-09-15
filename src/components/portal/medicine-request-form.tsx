"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import {
  requestMedicineRefill,
  requestMedicineNotify,
  type MedicineRequestState,
} from "@/actions/medicine-requests";
import { Button } from "@/components/ui/button";

// Shared "Request Refill" (bound to a prescription) / "Notify Pharmacy"
// (bound to a medicine) button — a single click, no form fields. Staff
// complete the request in person at the pharmacy counter; this just puts it
// on their queue.
function RequestButton({
  action,
  label,
  alreadyPending,
}: {
  action: (state: MedicineRequestState, formData: FormData) => Promise<MedicineRequestState>;
  label: string;
  alreadyPending: boolean;
}) {
  const t = useTranslations("portal.medicines");
  const [state, formAction, pending] = useActionState<MedicineRequestState, FormData>(action, {});

  if (state.success || alreadyPending) {
    return (
      <Button size="sm" variant="outline" disabled>
        {t("requestPending")}
      </Button>
    );
  }

  return (
    <form action={formAction} className="grid justify-items-end gap-1">
      <Button type="submit" size="sm" disabled={pending}>
        {label}
      </Button>
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
    </form>
  );
}

export function RequestRefillButton({
  prescriptionId,
  alreadyPending,
}: {
  prescriptionId: string;
  alreadyPending: boolean;
}) {
  const t = useTranslations("portal.medicines");
  return (
    <RequestButton
      action={requestMedicineRefill.bind(null, prescriptionId)}
      label={t("requestRefill")}
      alreadyPending={alreadyPending}
    />
  );
}

export function NotifyPharmacyButton({
  medicineId,
  alreadyPending,
}: {
  medicineId: string;
  alreadyPending: boolean;
}) {
  const t = useTranslations("portal.medicines");
  return (
    <RequestButton
      action={requestMedicineNotify.bind(null, medicineId)}
      label={t("notifyPharmacy")}
      alreadyPending={alreadyPending}
    />
  );
}

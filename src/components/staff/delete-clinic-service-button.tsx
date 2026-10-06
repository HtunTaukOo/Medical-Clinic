"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { deleteClinicService } from "@/actions/clinic-services";
import type { ClinicServiceFormState } from "@/actions/clinic-services";

export function DeleteClinicServiceButton({ serviceId, name }: { serviceId: string; name: string }) {
  const t = useTranslations("clinicServices");
  const [state, formAction, pending] = useActionState<ClinicServiceFormState, FormData>(
    deleteClinicService.bind(null, serviceId),
    {}
  );

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm(t("deleteConfirm", { name }))) e.preventDefault();
      }}
      className="inline-grid justify-items-end gap-1"
    >
      <button
        type="submit"
        disabled={pending}
        className="font-medium text-destructive underline underline-offset-2 disabled:opacity-50"
      >
        {t("delete")}
      </button>
      {state.error && <p className="max-w-48 text-right text-xs text-destructive">{state.error}</p>}
    </form>
  );
}

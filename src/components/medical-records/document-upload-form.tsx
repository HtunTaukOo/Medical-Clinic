"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import {
  uploadMedicalDocument,
  type MedicalRecordFormState,
} from "@/actions/medical-records";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DocumentUploadForm({ patientId }: { patientId: string }) {
  const t = useTranslations("portal.documents");
  const boundAction = uploadMedicalDocument.bind(null, patientId);
  const [state, formAction, pending] = useActionState<
    MedicalRecordFormState,
    FormData
  >(boundAction, {});

  return (
    <form action={formAction} className="grid max-w-md gap-3">
      <div className="grid gap-2">
        <Label htmlFor="file">{t("documentLabel")}</Label>
        <Input
          id="file"
          name="file"
          type="file"
          required
          accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.dcm"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="note">{t("noteOptional")}</Label>
        <Input id="note" name="note" placeholder={t("notePlaceholder")} />
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && <p className="text-sm text-muted-foreground">{t("uploaded")}</p>}
      <Button type="submit" disabled={pending} className="w-fit">
        {t("upload")}
      </Button>
    </form>
  );
}

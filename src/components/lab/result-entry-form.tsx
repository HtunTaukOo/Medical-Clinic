"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Upload } from "lucide-react";
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

type Item = {
  id: string;
  labTest: { name: string; unit: string | null; normalRange: string | null };
};

type ResultFormState = { error?: string; success?: boolean };

export function ResultEntryForm({
  action,
  items,
  showDocumentUpload,
}: {
  action: (prevState: ResultFormState, formData: FormData) => Promise<ResultFormState>;
  items: Item[];
  showDocumentUpload?: boolean;
}) {
  const t = useTranslations("lab");
  const [state, formAction, pending] = useActionState<ResultFormState, FormData>(action, {});

  return (
    <form action={formAction} className="grid gap-6">
      {items.map((item) => (
        <div key={item.id} className="grid gap-2 rounded-md border p-3">
          <p className="font-medium">{item.labTest.name}</p>
          {item.labTest.normalRange && (
            <p className="text-sm text-muted-foreground">
              {t("normalRange")}: {item.labTest.normalRange}
              {item.labTest.unit && ` ${item.labTest.unit}`}
            </p>
          )}
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="grid gap-1">
              <Label htmlFor={`result-${item.id}`}>{t("resultValue")}</Label>
              <Input
                id={`result-${item.id}`}
                name={`result-${item.id}`}
                placeholder={item.labTest.unit ?? "Value"}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor={`status-${item.id}`}>{t("status")}</Label>
              <Select name={`status-${item.id}`}>
                <SelectTrigger id={`status-${item.id}`} className="w-full">
                  <SelectValue placeholder={t("notSpecified")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NORMAL">{t("normal")}</SelectItem>
                  <SelectItem value="BORDERLINE">{t("borderline")}</SelectItem>
                  <SelectItem value="LOW">{t("low")}</SelectItem>
                  <SelectItem value="HIGH">{t("high")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <Label htmlFor={`note-${item.id}`}>{t("noteOptional")}</Label>
              <Input id={`note-${item.id}`} name={`note-${item.id}`} />
            </div>
          </div>
        </div>
      ))}
      {showDocumentUpload && (
        <div className="grid gap-2">
          <Label htmlFor="document">{t("documentOptional")}</Label>
          <div className="relative">
            <Upload className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="document"
              name="document"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              className="pl-8"
            />
          </div>
        </div>
      )}
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending} className="w-fit">
        {t("saveResults")}
      </Button>
    </form>
  );
}

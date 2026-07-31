"use client";

import { useActionState, useState } from "react";
import { addDiagnosis, type DiagnosisFormState } from "@/actions/diagnoses";
import { COMMON_ICD10_CODES } from "@/lib/icd10";
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

export function DiagnosisForm({ appointmentId }: { appointmentId: string }) {
  const boundAction = addDiagnosis.bind(null, appointmentId);
  const [state, formAction, pending] = useActionState<DiagnosisFormState, FormData>(
    boundAction,
    {}
  );
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");

  function handlePreset(value: string) {
    if (value === "custom") return;
    const preset = COMMON_ICD10_CODES.find((c) => c.code === value);
    if (preset) {
      setCode(preset.code);
      setDescription(preset.description);
    }
  }

  return (
    <form action={formAction} key={state.success ? "reset" : "form"} className="grid gap-3">
      <div className="grid gap-2">
        <Label>Common diagnoses</Label>
        <Select onValueChange={handlePreset}>
          <SelectTrigger id="diagnosis-quickpick" className="w-full">
            <SelectValue placeholder="Quick pick (optional), or enter your own below" />
          </SelectTrigger>
          <SelectContent>
            {COMMON_ICD10_CODES.map((c) => (
              <SelectItem key={c.code} value={c.code}>
                {c.code} — {c.description}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-[140px_1fr] gap-2">
        <div className="grid gap-1.5">
          <Label htmlFor="diagnosis-code">ICD-10 code</Label>
          <Input
            id="diagnosis-code"
            name="code"
            placeholder="e.g. J00"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="diagnosis-description">Diagnosis</Label>
          <Input
            id="diagnosis-description"
            name="description"
            required
            placeholder="e.g. Acute nasopharyngitis (common cold)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="diagnosis-notes">Notes (optional)</Label>
        <Textarea id="diagnosis-notes" name="notes" rows={2} />
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending || !description} className="w-fit">
        Add diagnosis
      </Button>
    </form>
  );
}

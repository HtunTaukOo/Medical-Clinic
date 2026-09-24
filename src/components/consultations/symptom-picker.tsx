"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const COMMON_SYMPTOMS = [
  "Fever",
  "Cough",
  "Dyspnea",
  "Chest Pain",
  "Fatigue",
  "Headache",
  "Nausea",
  "Dizziness",
  "Back Pain",
  "Joint Pain",
  "Palpitations",
  "Oedema",
];

export function SymptomPicker({
  formId,
  defaultValues,
}: {
  formId: string;
  defaultValues: string[];
}) {
  const [selected, setSelected] = useState<string[]>(defaultValues);
  // Custom symptoms the doctor has typed in, kept as their own pill list so
  // toggling one off (deselecting) just dims it like a common symptom does,
  // instead of the pill vanishing entirely because it was only ever derived
  // from the selected list itself.
  const [customSymptoms, setCustomSymptoms] = useState<string[]>(
    defaultValues.filter((s) => !COMMON_SYMPTOMS.includes(s))
  );
  const [custom, setCustom] = useState("");

  function toggle(symptom: string) {
    setSelected((prev) =>
      prev.includes(symptom) ? prev.filter((s) => s !== symptom) : [...prev, symptom]
    );
  }

  function addCustom() {
    const value = custom.trim();
    if (value) {
      setCustomSymptoms((prev) => (prev.includes(value) ? prev : [...prev, value]));
      setSelected((prev) => (prev.includes(value) ? prev : [...prev, value]));
    }
    setCustom("");
  }

  function removeCustom(symptom: string) {
    setCustomSymptoms((prev) => prev.filter((s) => s !== symptom));
    setSelected((prev) => prev.filter((s) => s !== symptom));
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        {[...COMMON_SYMPTOMS, ...customSymptoms].map((symptom) => {
          const active = selected.includes(symptom);
          const isCustom = customSymptoms.includes(symptom);
          return (
            <span
              key={symptom}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border pl-3 pr-1.5 py-1.5 text-sm transition-colors",
                !isCustom && "pr-3",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background hover:bg-muted"
              )}
            >
              <button type="button" onClick={() => toggle(symptom)}>
                {symptom}
              </button>
              {isCustom && (
                <button
                  type="button"
                  onClick={() => removeCustom(symptom)}
                  aria-label={`Remove ${symptom}`}
                  className={cn(
                    "rounded-full p-0.5 transition-colors",
                    active ? "hover:bg-white/20" : "hover:bg-black/10"
                  )}
                >
                  <X className="size-3" />
                </button>
              )}
            </span>
          );
        })}
      </div>
      <div className="flex gap-2">
        <Input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="Add other symptom..."
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustom();
            }
          }}
        />
        <Button type="button" variant="secondary" onClick={addCustom}>
          Add
        </Button>
      </div>
      {selected.map((symptom) => (
        <input key={symptom} type="hidden" name="symptoms" value={symptom} form={formId} />
      ))}
    </div>
  );
}

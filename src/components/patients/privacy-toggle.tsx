"use client";

import { useState, useTransition } from "react";
import { updatePrivacySetting, type PrivacyField } from "@/actions/patients";
import { Switch } from "@/components/ui/switch";

export function PrivacyToggle({
  field,
  label,
  description,
  defaultChecked,
}: {
  field: PrivacyField;
  label: string;
  description: string;
  defaultChecked: boolean;
}) {
  const [checked, setChecked] = useState(defaultChecked);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch
        checked={checked}
        disabled={isPending}
        onCheckedChange={(value) => {
          setChecked(value);
          startTransition(async () => {
            await updatePrivacySetting(field, value);
          });
        }}
      />
    </div>
  );
}

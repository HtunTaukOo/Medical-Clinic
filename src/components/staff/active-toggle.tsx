"use client";

import { useState, useTransition } from "react";
import { Switch } from "@/components/ui/switch";

export function ActiveToggle({
  active,
  action,
}: {
  active: boolean;
  action: () => Promise<void>;
}) {
  const [checked, setChecked] = useState(active);
  const [isPending, startTransition] = useTransition();

  return (
    <Switch
      checked={checked}
      disabled={isPending}
      onCheckedChange={(value) => {
        setChecked(value);
        startTransition(async () => {
          await action();
        });
      }}
    />
  );
}

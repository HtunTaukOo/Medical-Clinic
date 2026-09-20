"use client";

import { useState, useTransition } from "react";
import { setStaffPermission } from "@/actions/staff";
import type { StaffPermissionKey } from "@/lib/permissions";

export function StaffPermissionToggle({
  permKey,
  defaultEnabled,
}: {
  permKey: StaffPermissionKey;
  defaultEnabled: boolean;
}) {
  const [enabled, setEnabled] = useState(defaultEnabled);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex justify-center">
      <input
        type="checkbox"
        checked={enabled}
        disabled={isPending}
        onChange={(e) => {
          const value = e.target.checked;
          setEnabled(value);
          startTransition(async () => {
            await setStaffPermission(permKey, value);
          });
        }}
        className="size-4 accent-primary disabled:opacity-60"
      />
    </div>
  );
}

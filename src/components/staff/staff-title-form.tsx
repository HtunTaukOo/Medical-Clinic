"use client";

import { useTransition } from "react";
import { updateStaffTitle } from "@/actions/staff";
import { STAFF_TITLES } from "@/lib/staff-titles";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function StaffTitleForm({ userId, title }: { userId: string; title: string | null }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Select
      value={title ?? undefined}
      disabled={isPending}
      onValueChange={(value) => {
        startTransition(async () => {
          const formData = new FormData();
          formData.set("title", value);
          await updateStaffTitle(userId, {}, formData);
        });
      }}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Set job title..." />
      </SelectTrigger>
      <SelectContent>
        {STAFF_TITLES.map((t) => (
          <SelectItem key={t} value={t}>
            {t}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

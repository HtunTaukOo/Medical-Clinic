"use client";

import { useSearchParams } from "next/navigation";
import { useRouter, usePathname } from "@/i18n/navigation";
import { VITALS_RANGE_OPTIONS, type VitalsRangeKey } from "@/lib/vitals";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function VitalsRangeFilter({ defaultRange }: { defaultRange: VitalsRangeKey }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const range = searchParams.get("vitalsRange") ?? defaultRange;

  function update(value: string) {
    const params = new URLSearchParams(window.location.search);
    params.set("vitalsRange", value);
    router.replace(`${pathname}?${params.toString()}#vitals-history`);
  }

  return (
    <Select value={range} onValueChange={update}>
      <SelectTrigger className="w-40" size="sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {VITALS_RANGE_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

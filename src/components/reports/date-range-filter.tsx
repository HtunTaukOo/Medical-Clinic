"use client";

import { useSearchParams } from "next/navigation";
import { useRouter, usePathname } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DateRangeFilter({
  defaultFrom,
  defaultTo,
}: {
  defaultFrom: string;
  defaultTo: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? defaultFrom;
  const to = searchParams.get("to") ?? defaultTo;

  function update(key: "from" | "to", value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <Label htmlFor="report-from" className="text-sm text-muted-foreground">
          From
        </Label>
        <Input
          id="report-from"
          type="date"
          value={from}
          onChange={(e) => update("from", e.target.value)}
          className="w-40"
        />
      </div>
      <div className="flex items-center gap-2">
        <Label htmlFor="report-to" className="text-sm text-muted-foreground">
          To
        </Label>
        <Input
          id="report-to"
          type="date"
          value={to}
          onChange={(e) => update("to", e.target.value)}
          className="w-40"
        />
      </div>
    </div>
  );
}

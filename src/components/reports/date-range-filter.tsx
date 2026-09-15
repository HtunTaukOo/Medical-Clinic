"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter, usePathname } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

function startOfMonthKey(todayKey: string) {
  return `${todayKey.slice(0, 7)}-01`;
}

function startOfYearKey(todayKey: string) {
  return `${todayKey.slice(0, 4)}-01-01`;
}

export function DateRangeFilter({
  defaultFrom,
  defaultTo,
  todayKey,
}: {
  defaultFrom: string;
  defaultTo: string;
  // Clinic-local "today" as YYYY-MM-DD — computed server-side so the Day/
  // Month/Year presets line up with the clinic's own calendar day rather
  // than whatever timezone the viewer's browser happens to be in.
  todayKey: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Tracked in local state (not read back from `searchParams`/the URL) so
  // that From and To updating in quick succession can't race: a functional
  // setState updater always composes onto the *result* of the previous
  // update, regardless of whether the router navigation it triggered has
  // resolved yet.
  const [range, setRangeState] = useState({
    from: searchParams.get("from") ?? defaultFrom,
    to: searchParams.get("to") ?? defaultTo,
  });

  function navigateTo(next: { from: string; to: string }) {
    const params = new URLSearchParams(window.location.search);
    params.set("from", next.from);
    params.set("to", next.to);
    router.replace(`${pathname}?${params.toString()}`);
  }

  function update(key: "from" | "to", value: string) {
    setRangeState((prev) => {
      const next = { ...prev, [key]: value };
      navigateTo(next);
      return next;
    });
  }

  function setRange(newFrom: string, newTo: string) {
    const next = { from: newFrom, to: newTo };
    setRangeState(next);
    navigateTo(next);
  }

  const { from, to } = range;
  const monthStart = startOfMonthKey(todayKey);
  const yearStart = startOfYearKey(todayKey);
  const isToday = from === todayKey && to === todayKey;
  const isThisMonth = from === monthStart && to === todayKey;
  const isThisYear = from === yearStart && to === todayKey;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          size="sm"
          variant={isToday ? "default" : "outline"}
          onClick={() => setRange(todayKey, todayKey)}
        >
          Day
        </Button>
        <Button
          type="button"
          size="sm"
          variant={isThisMonth ? "default" : "outline"}
          onClick={() => setRange(monthStart, todayKey)}
        >
          Month
        </Button>
        <Button
          type="button"
          size="sm"
          variant={isThisYear ? "default" : "outline"}
          onClick={() => setRange(yearStart, todayKey)}
        >
          Year
        </Button>
      </div>
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

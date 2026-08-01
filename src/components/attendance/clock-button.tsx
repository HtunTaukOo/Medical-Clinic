"use client";

import { useTranslations } from "next-intl";
import { clockIn, clockOut } from "@/actions/attendance";
import { Button } from "@/components/ui/button";

export function ClockButton({ isClockedIn }: { isClockedIn: boolean }) {
  const t = useTranslations("attendance");

  return (
    <form action={isClockedIn ? clockOut : clockIn}>
      <Button type="submit" variant={isClockedIn ? "destructive" : "default"}>
        {isClockedIn ? t("clockOut") : t("clockIn")}
      </Button>
    </form>
  );
}

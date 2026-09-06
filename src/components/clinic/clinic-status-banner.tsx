import { getTranslations } from "next-intl/server";
import { getClinicHoursForDate, isWithinOpeningHours, formatTime } from "@/lib/clinic-hours";
import { Badge } from "@/components/ui/badge";

export async function ClinicStatusBanner({
  variant = "standalone",
}: {
  variant?: "standalone" | "hero";
} = {}) {
  const t = await getTranslations("clinic");
  const now = new Date();
  const todayHours = await getClinicHoursForDate(now);
  const openNow = todayHours.isOpen && isWithinOpeningHours(now, todayHours.openTime, todayHours.closeTime);

  if (variant === "hero") {
    return (
      <div className="flex flex-wrap items-center gap-3 text-sm text-primary-foreground/90">
        <Badge variant="outline" className="border-white/30 bg-white/10 text-primary-foreground">
          {openNow ? t("statusOpenNow") : t("statusClosedNow")}
        </Badge>
        {todayHours.isOpen && (
          <span>
            {t("hoursToday", {
              opening: formatTime(todayHours.openTime),
              closing: formatTime(todayHours.closeTime),
            })}
          </span>
        )}
        {!todayHours.isOpen && (
          <span className="text-rose-100">{t("closedForBookings")}</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
      <Badge variant={openNow ? "success" : "destructive"}>
        {openNow ? t("statusOpenNow") : t("statusClosedNow")}
      </Badge>
      {todayHours.isOpen && (
        <span className="text-muted-foreground">
          {t("hoursToday", {
            opening: formatTime(todayHours.openTime),
            closing: formatTime(todayHours.closeTime),
          })}
        </span>
      )}
      {!todayHours.isOpen && (
        <span className="text-destructive">{t("closedForBookings")}</span>
      )}
    </div>
  );
}

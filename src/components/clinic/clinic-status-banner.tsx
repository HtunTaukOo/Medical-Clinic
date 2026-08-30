import { getTranslations } from "next-intl/server";
import { getClinicSettings, isWithinOpeningHours, formatTime } from "@/lib/clinic-hours";
import { Badge } from "@/components/ui/badge";

export async function ClinicStatusBanner({
  variant = "standalone",
}: {
  variant?: "standalone" | "hero";
} = {}) {
  const t = await getTranslations("clinic");
  const settings = await getClinicSettings();
  const openNow = settings.isOpen && isWithinOpeningHours(new Date(), settings.openingTime, settings.closingTime);

  if (variant === "hero") {
    return (
      <div className="flex flex-wrap items-center gap-3 text-sm text-primary-foreground/90">
        <Badge variant="outline" className="border-white/30 bg-white/10 text-primary-foreground">
          {openNow ? t("statusOpenNow") : t("statusClosedNow")}
        </Badge>
        <span>
          {t("hoursToday", {
            opening: formatTime(settings.openingTime),
            closing: formatTime(settings.closingTime),
          })}
        </span>
        {!settings.isOpen && (
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
      <span className="text-muted-foreground">
        {t("hoursToday", {
          opening: formatTime(settings.openingTime),
          closing: formatTime(settings.closingTime),
        })}
      </span>
      {!settings.isOpen && (
        <span className="text-destructive">{t("closedForBookings")}</span>
      )}
    </div>
  );
}

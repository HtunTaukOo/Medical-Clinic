import { getTranslations } from "next-intl/server";
import { getClinicSettings, isWithinOpeningHours, formatTime } from "@/lib/clinic-hours";
import { Badge } from "@/components/ui/badge";

export async function ClinicStatusBanner() {
  const t = await getTranslations("clinic");
  const settings = await getClinicSettings();
  const openNow = settings.isOpen && isWithinOpeningHours(new Date(), settings.openingTime, settings.closingTime);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
      <Badge variant={openNow ? "default" : "destructive"}>
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

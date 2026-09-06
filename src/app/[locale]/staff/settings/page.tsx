import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/authz";
import { getClinicSettings } from "@/lib/clinic-hours";
import { ClinicSettingsForm } from "@/components/clinic/clinic-settings-form";

export default async function ClinicSettingsPage() {
  await requirePageRole(["ADMIN"]);
  const t = await getTranslations("clinic");
  const settings = await getClinicSettings();

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">
          Configure clinic hours, contact details, and notifications.
        </p>
      </div>
      <ClinicSettingsForm
        isOpen={settings.isOpen}
        openingTime={settings.openingTime}
        closingTime={settings.closingTime}
        staffTelegramChatId={settings.staffTelegramChatId}
        phones={settings.phones}
        address={settings.address}
      />
    </div>
  );
}

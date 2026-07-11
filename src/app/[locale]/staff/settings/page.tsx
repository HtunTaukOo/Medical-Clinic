import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/authz";
import { getClinicSettings } from "@/lib/clinic-hours";
import { ClinicSettingsForm } from "@/components/clinic/clinic-settings-form";

export default async function ClinicSettingsPage() {
  await requireRole(["ADMIN"]);
  const t = await getTranslations("clinic");
  const settings = await getClinicSettings();

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <ClinicSettingsForm
        isOpen={settings.isOpen}
        openingTime={settings.openingTime}
        closingTime={settings.closingTime}
      />
    </div>
  );
}

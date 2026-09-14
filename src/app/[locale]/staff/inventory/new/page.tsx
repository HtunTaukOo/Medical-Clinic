import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/authz";
import { BackLink } from "@/components/back-link";
import { MedicineForm } from "@/components/inventory/medicine-form";

export default async function NewMedicinePage() {
  await requirePageRole(["ADMIN", "STAFF"]);
  const t = await getTranslations("inventory");

  return (
    <div className="grid gap-4">
      <BackLink href="/staff/inventory" />
      <h1 className="text-2xl font-semibold">{t("newMedicine")}</h1>
      <MedicineForm />
    </div>
  );
}

import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/authz";
import { MedicineForm } from "@/components/inventory/medicine-form";

export default async function NewMedicinePage() {
  await requireRole(["ADMIN", "PHARMACIST"]);
  const t = await getTranslations("inventory");

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-semibold">{t("newMedicine")}</h1>
      <MedicineForm />
    </div>
  );
}

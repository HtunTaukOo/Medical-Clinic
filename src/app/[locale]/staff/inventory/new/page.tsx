import { ChevronLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/authz";
import { Link } from "@/i18n/navigation";
import { MedicineForm } from "@/components/inventory/medicine-form";

export default async function NewMedicinePage() {
  await requirePageRole(["ADMIN", "STAFF"]);
  const t = await getTranslations("inventory");

  return (
    <div className="grid gap-4">
      <Link
        href="/staff/inventory"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Back
      </Link>
      <h1 className="text-2xl font-semibold">{t("newMedicine")}</h1>
      <MedicineForm />
    </div>
  );
}

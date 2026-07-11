import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/authz";
import { StaffForm } from "@/components/staff/staff-form";

export default async function NewStaffPage() {
  await requireRole(["ADMIN"]);
  const t = await getTranslations("staff");

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-semibold">{t("new")}</h1>
      <StaffForm />
    </div>
  );
}

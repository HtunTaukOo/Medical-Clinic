import { requirePageRole } from "@/lib/authz";
import { BackLink } from "@/components/back-link";
import { LabTestForm } from "@/components/lab/lab-test-form";
import { getTranslations } from "next-intl/server";

export default async function NewLabTestPage() {
  await requirePageRole(["ADMIN", "STAFF"]);
  const t = await getTranslations("lab");

  return (
    <div className="grid gap-4">
      <BackLink href="/staff/lab?tab=catalog" />
      <h1 className="text-2xl font-semibold">{t("newLabTest")}</h1>
      <LabTestForm />
    </div>
  );
}

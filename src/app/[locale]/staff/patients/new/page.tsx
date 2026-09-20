import { getTranslations, getLocale } from "next-intl/server";
import { requirePageRole, homeForRole } from "@/lib/authz";
import { redirect } from "@/i18n/navigation";
import { isStaffPermissionEnabled } from "@/lib/permissions";
import { createPatient } from "@/actions/patients";
import { PatientForm } from "@/components/patients/patient-form";

export default async function NewPatientPage() {
  const session = await requirePageRole(["ADMIN", "DOCTOR", "STAFF"]);
  if (session.user.role === "STAFF" && !(await isStaffPermissionEnabled("EDIT_PATIENTS"))) {
    const locale = await getLocale();
    redirect({ href: homeForRole(session.user.role), locale });
  }
  const t = await getTranslations("patients");

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-semibold">{t("new")}</h1>
      <PatientForm action={createPatient} redirectOnSuccess="/staff/patients" />
    </div>
  );
}

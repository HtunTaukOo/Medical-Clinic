import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/authz";
import { createPatient } from "@/actions/patients";
import { PatientForm } from "@/components/patients/patient-form";

export default async function NewPatientPage() {
  await requirePageRole(["ADMIN", "DOCTOR", "RECEPTIONIST"]);
  const t = await getTranslations("patients");

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-semibold">{t("new")}</h1>
      <PatientForm action={createPatient} redirectOnSuccess="/staff/patients" />
    </div>
  );
}

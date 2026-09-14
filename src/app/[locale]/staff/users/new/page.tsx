import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/authz";
import { getActiveSpecialties } from "@/lib/specialties-data";
import { BackLink } from "@/components/back-link";
import { StaffForm } from "@/components/staff/staff-form";

export default async function NewStaffPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  await requirePageRole(["ADMIN"]);
  const t = await getTranslations("staff");
  const { role } = await searchParams;
  const lockRole = role === "DOCTOR" ? "DOCTOR" : undefined;
  const backHref = lockRole ? "/staff/doctors" : "/staff/users";
  const specialties = await getActiveSpecialties();

  return (
    <div className="grid gap-4">
      <BackLink href={backHref} />
      <h1 className="text-2xl font-semibold">{lockRole ? "Add Doctor" : t("new")}</h1>
      <StaffForm
        lockRole={lockRole}
        redirectTo={lockRole ? "/staff/doctors" : "/staff/users"}
        specialties={specialties.map((s) => ({ name: s.name }))}
      />
    </div>
  );
}

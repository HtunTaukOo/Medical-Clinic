import { ChevronLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/authz";
import { Link } from "@/i18n/navigation";
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

  return (
    <div className="grid gap-4">
      <Link
        href={backHref}
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Back
      </Link>
      <h1 className="text-2xl font-semibold">{lockRole ? "Add Doctor" : t("new")}</h1>
      <StaffForm lockRole={lockRole} redirectTo={lockRole ? "/staff/doctors" : "/staff/users"} />
    </div>
  );
}

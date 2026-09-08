import { ChevronLeft } from "lucide-react";
import { requirePageRole } from "@/lib/authz";
import { getActiveSpecialties } from "@/lib/specialties-data";
import { Link } from "@/i18n/navigation";
import { ClinicServiceForm } from "@/components/staff/clinic-service-form";

export default async function NewClinicServicePage() {
  await requirePageRole(["ADMIN"]);
  const specialties = await getActiveSpecialties();

  return (
    <div className="grid gap-4">
      <Link
        href="/staff/clinic-services"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Back
      </Link>
      <h1 className="text-2xl font-semibold">Add Service</h1>
      <ClinicServiceForm specialties={specialties.map((s) => ({ name: s.name }))} />
    </div>
  );
}

import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/authz";
import { getActiveSpecialties } from "@/lib/specialties-data";
import { BackLink } from "@/components/back-link";
import { ClinicServiceForm } from "@/components/staff/clinic-service-form";

export default async function NewClinicServicePage() {
  await requirePageRole(["ADMIN"]);
  const [specialties, labTests] = await Promise.all([
    getActiveSpecialties(),
    prisma.labTest.findMany({ where: { clinicService: null }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="grid gap-4">
      <BackLink href="/staff/clinic-services" />
      <h1 className="text-2xl font-semibold">Add Service</h1>
      <ClinicServiceForm
        specialties={specialties.map((s) => ({ name: s.name, bookByService: s.bookingMode === "SERVICE_CAPACITY" }))}
        labTests={labTests.map((t) => ({ id: t.id, name: t.name, price: Number(t.price) }))}
      />
    </div>
  );
}

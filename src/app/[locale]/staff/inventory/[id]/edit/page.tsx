import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/authz";
import { BackLink } from "@/components/back-link";
import { MedicineForm } from "@/components/inventory/medicine-form";

export default async function EditMedicinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageRole(["ADMIN", "STAFF"]);
  const { id } = await params;

  const medicine = await prisma.medicine.findUnique({ where: { id } });
  if (!medicine) notFound();

  return (
    <div className="grid gap-4">
      <BackLink href={`/staff/inventory/${medicine.id}`} />
      <h1 className="text-2xl font-semibold">Edit medicine</h1>
      <MedicineForm
        medicine={{
          id: medicine.id,
          name: medicine.name,
          unit: medicine.unit,
          reorderLevel: medicine.reorderLevel,
          price: Number(medicine.price),
        }}
      />
    </div>
  );
}

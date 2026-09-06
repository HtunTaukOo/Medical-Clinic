import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/authz";
import { Link } from "@/i18n/navigation";
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
      <Link
        href={`/staff/inventory/${medicine.id}`}
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Back
      </Link>
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

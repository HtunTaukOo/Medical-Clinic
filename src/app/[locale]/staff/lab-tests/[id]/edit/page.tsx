import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/authz";
import { BackLink } from "@/components/back-link";
import { LabTestForm } from "@/components/lab/lab-test-form";

export default async function EditLabTestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageRole(["ADMIN", "STAFF"]);
  const { id } = await params;

  const test = await prisma.labTest.findUnique({ where: { id } });
  if (!test) notFound();

  return (
    <div className="grid gap-4">
      <BackLink href="/staff/lab?tab=catalog" />
      <h1 className="text-2xl font-semibold">Edit Lab Test</h1>
      <LabTestForm
        test={{
          id: test.id,
          name: test.name,
          unit: test.unit,
          normalRange: test.normalRange,
          price: Number(test.price),
          category: test.category,
          requiresExternalLab: test.requiresExternalLab,
        }}
      />
    </div>
  );
}

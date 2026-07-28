import { requireRole } from "@/lib/authz";
import { LabTestForm } from "@/components/lab/lab-test-form";

export default async function NewLabTestPage() {
  await requireRole(["ADMIN", "LAB_TECH"]);

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-semibold">New Lab Test</h1>
      <LabTestForm />
    </div>
  );
}

import { ChevronLeft } from "lucide-react";
import { requirePageRole } from "@/lib/authz";
import { Link } from "@/i18n/navigation";
import { LabTestForm } from "@/components/lab/lab-test-form";

export default async function NewLabTestPage() {
  await requirePageRole(["ADMIN", "STAFF"]);

  return (
    <div className="grid gap-4">
      <Link
        href="/staff/lab?tab=catalog"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Back
      </Link>
      <h1 className="text-2xl font-semibold">New Lab Test</h1>
      <LabTestForm />
    </div>
  );
}

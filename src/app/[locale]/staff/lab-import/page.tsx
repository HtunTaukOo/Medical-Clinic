import { requirePageRole } from "@/lib/authz";
import { LabImportPanel } from "@/components/staff/lab-import-panel";

// TEMPORARY page — see src/actions/lab-import-temp.ts. Delete this whole
// route (and that action file + LabImportPanel) once the production lab
// test import has been run and verified.
export default async function LabImportPage() {
  await requirePageRole(["ADMIN"]);

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-semibold">One-off Lab Test Import (temporary)</h1>
      <p className="text-sm text-muted-foreground">
        Bulk-imports the clinic&apos;s lab test price sheet into the LabTest and ClinicService
        catalogs. Preview first, then run once. This page should be removed after use.
      </p>
      <LabImportPanel />
    </div>
  );
}

import { requirePageRole } from "@/lib/authz";
import { MedicineImportPanel } from "@/components/staff/medicine-import-panel";

// TEMPORARY page — see src/actions/medicine-import-temp.ts. Delete this
// whole route (and that action file + MedicineImportPanel) once the
// production medicine catalog import has been run and verified.
export default async function MedicineImportPage() {
  await requirePageRole(["ADMIN"]);

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-semibold">One-off Medicine Catalog Import (temporary)</h1>
      <p className="text-sm text-muted-foreground">
        Bulk-imports the clinic&apos;s pharmacy price sheet into the Medicine catalog, with
        realistic starting stock levels and expiry dates. Preview first, then run once. This page
        should be removed after use.
      </p>
      <MedicineImportPanel />
    </div>
  );
}

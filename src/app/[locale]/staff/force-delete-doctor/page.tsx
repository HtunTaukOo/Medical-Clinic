import { requirePageRole } from "@/lib/authz";
import { listDoctorsWithHistory } from "@/actions/force-delete-doctor-temp";
import { ForceDeleteDoctorPanel } from "@/components/staff/force-delete-doctor-panel";

// TEMPORARY page — see src/actions/force-delete-doctor-temp.ts. Delete this
// whole route (and that action file + ForceDeleteDoctorPanel) once the two
// test doctor accounts have been removed from production and verified.
export default async function ForceDeleteDoctorPage() {
  await requirePageRole(["ADMIN"]);
  const doctors = await listDoctorsWithHistory();

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-semibold">Force Delete Doctor (temporary)</h1>
      <p className="text-sm text-muted-foreground">
        For removing test doctor accounts that have attached history (appointments, diagnoses,
        prescriptions, lab orders, walk-ins) — the normal delete on /staff/users refuses those on
        purpose. This permanently deletes that history along with the account. This page should be
        removed after use.
      </p>
      <ForceDeleteDoctorPanel doctors={doctors} />
    </div>
  );
}

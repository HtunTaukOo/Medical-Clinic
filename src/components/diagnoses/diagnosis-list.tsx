import { Stethoscope } from "lucide-react";
import { deleteDiagnosis } from "@/actions/diagnoses";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";

type DiagnosisItem = {
  id: string;
  code: string | null;
  description: string;
  notes: string | null;
  createdAt: Date;
  doctor?: { user: { name: string } };
};

export function DiagnosisList({
  diagnoses,
  canDelete = false,
  showDoctor = false,
}: {
  diagnoses: DiagnosisItem[];
  canDelete?: boolean;
  showDoctor?: boolean;
}) {
  if (diagnoses.length === 0) {
    return <EmptyState icon={Stethoscope} message="No diagnoses recorded yet." />;
  }

  return (
    <div className="grid gap-2">
      {diagnoses.map((d) => (
        <div key={d.id} className="flex items-start justify-between gap-2 rounded-lg border p-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {d.code && <Badge variant="outline">{d.code}</Badge>}
              <span className="font-medium">{d.description}</span>
            </div>
            {d.notes && <p className="mt-1 text-sm text-muted-foreground">{d.notes}</p>}
            <p className="mt-1 text-xs text-muted-foreground">
              {showDoctor && d.doctor ? `${d.doctor.user.name} — ` : ""}
              {new Date(d.createdAt).toLocaleString()}
            </p>
          </div>
          {canDelete && (
            <form action={deleteDiagnosis.bind(null, d.id)}>
              <Button size="sm" variant="destructive" type="submit">
                Remove
              </Button>
            </form>
          )}
        </div>
      ))}
    </div>
  );
}

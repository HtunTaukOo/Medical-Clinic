import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const ALLERGY_SEVERITY_STYLES: Record<string, string> = {
  SEVERE: "bg-red-600 text-white",
  MODERATE: "bg-amber-100 text-amber-800",
  MILD: "bg-amber-50 text-amber-700",
};

export function ConsultationSidebar({
  allergies,
  activeConditions,
  currentMedications,
  lastVisitNote,
}: {
  allergies: { id: string; name: string; reaction: string | null; severity: string }[];
  activeConditions: { id: string; description: string }[];
  currentMedications: { id: string; medicine: { name: string }; dosage: string; frequency: string | null }[];
  lastVisitNote: { note: string; date: Date } | null;
}) {
  return (
    <div className="grid gap-4">
      {allergies.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-red-700 uppercase">
            <AlertTriangle className="size-3.5" />
            Allergy Alert
          </div>
          <div className="grid gap-1.5">
            {allergies.map((a) => (
              <div
                key={a.id}
                className={`rounded-lg px-2.5 py-1.5 text-sm ${ALLERGY_SEVERITY_STYLES[a.severity]}`}
              >
                <p className="font-medium">{a.name}</p>
                {a.reaction && <p className="text-xs opacity-90">{a.reaction}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Active Conditions
        </p>
        {activeConditions.length === 0 ? (
          <p className="text-sm text-muted-foreground">None on file.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {activeConditions.map((d) => (
              <Badge key={d.id} variant="outline" className="bg-amber-100 text-amber-700">
                {d.description}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Current Medications
        </p>
        {currentMedications.length === 0 ? (
          <p className="text-sm text-muted-foreground">None active.</p>
        ) : (
          <ul className="grid gap-1 text-sm">
            {currentMedications.map((item) => (
              <li key={item.id} className="flex items-start gap-1.5">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-blue-500" />
                <span>
                  {item.medicine.name} {item.dosage}
                  {item.frequency && ` ${item.frequency}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {lastVisitNote && (
        <div>
          <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Last Visit Note
          </p>
          <p className="text-sm text-muted-foreground italic">&ldquo;{lastVisitNote.note}&rdquo;</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {lastVisitNote.date.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
      )}
    </div>
  );
}

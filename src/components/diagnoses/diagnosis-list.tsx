import { Stethoscope } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { deleteDiagnosis, setDiagnosisStatus } from "@/actions/diagnoses";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";

type DiagnosisItem = {
  id: string;
  code: string | null;
  description: string;
  notes: string | null;
  status: "ACTIVE" | "RESOLVED";
  severity: "MILD" | "MODERATE" | "SEVERE" | null;
  createdAt: Date;
  doctor?: { user: { name: string } };
};

export async function DiagnosisList({
  diagnoses,
  canDelete = false,
  showDoctor = false,
}: {
  diagnoses: DiagnosisItem[];
  canDelete?: boolean;
  showDoctor?: boolean;
}) {
  const t = await getTranslations("portal.diagnoses");
  const SEVERITY_LABELS: Record<string, string> = {
    MILD: t("severityMild"),
    MODERATE: t("severityModerate"),
    SEVERE: t("severitySevere"),
  };

  if (diagnoses.length === 0) {
    return <EmptyState icon={Stethoscope} message={t("noDiagnoses")} />;
  }

  return (
    <div className="grid gap-2">
      {diagnoses.map((d) => (
        <div key={d.id} className="flex items-start justify-between gap-2 rounded-lg border p-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {d.code && <Badge variant="outline">{d.code}</Badge>}
              <span className="font-medium">{d.description}</span>
              <Badge variant={d.status === "ACTIVE" ? "default" : "success"}>
                {d.status === "ACTIVE" ? t("statusActive") : t("statusResolved")}
              </Badge>
              {d.severity && <Badge variant="outline">{SEVERITY_LABELS[d.severity]}</Badge>}
            </div>
            {d.notes && <p className="mt-1 text-sm text-muted-foreground">{d.notes}</p>}
            <p className="mt-1 text-xs text-muted-foreground">
              {showDoctor && d.doctor ? `${d.doctor.user.name} — ` : ""}
              {new Date(d.createdAt).toLocaleString()}
            </p>
          </div>
          {canDelete && (
            <div className="flex shrink-0 items-center gap-2">
              <form
                action={setDiagnosisStatus.bind(
                  null,
                  d.id,
                  d.status === "ACTIVE" ? "RESOLVED" : "ACTIVE"
                )}
              >
                <Button size="sm" variant="outline" type="submit">
                  {d.status === "ACTIVE" ? t("markResolved") : t("reopen")}
                </Button>
              </form>
              <form action={deleteDiagnosis.bind(null, d.id)}>
                <Button size="sm" variant="destructive" type="submit">
                  {t("remove")}
                </Button>
              </form>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

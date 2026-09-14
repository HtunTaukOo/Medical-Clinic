import { FlaskConical } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";

type LabResultRow = {
  id: string;
  labOrderId: string;
  testName: string;
  resultValue: string | null;
  unit: string | null;
  normalRange: string | null;
  resultStatus: "NORMAL" | "BORDERLINE" | "LOW" | "HIGH" | null;
  date: Date | null;
};

const STATUS_STYLES: Record<string, string> = {
  NORMAL: "bg-emerald-100 text-emerald-700",
  BORDERLINE: "bg-amber-100 text-amber-700",
  HIGH: "bg-red-100 text-red-700",
  LOW: "bg-blue-100 text-blue-700",
};

export async function LabResultsTable({ rows }: { rows: LabResultRow[] }) {
  const t = await getTranslations("portal.labResults");
  const STATUS_LABELS: Record<string, string> = {
    NORMAL: t("statusNormal"),
    BORDERLINE: t("statusBorderline"),
    HIGH: t("statusHigh"),
    LOW: t("statusLow"),
  };

  if (rows.length === 0) {
    return <EmptyState icon={FlaskConical} message={t("noResults")} />;
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-xs tracking-wide text-muted-foreground uppercase">
            <th className="px-4 py-2.5 font-medium">{t("colTest")}</th>
            <th className="px-4 py-2.5 font-medium">{t("colResult")}</th>
            <th className="px-4 py-2.5 font-medium">{t("colReference")}</th>
            <th className="px-4 py-2.5 font-medium">{t("colStatus")}</th>
            <th className="px-4 py-2.5 font-medium">{t("colDate")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b last:border-0">
              <td className="px-4 py-3">
                <Link href={`/lab-report/${row.labOrderId}`} className="font-medium hover:underline">
                  {row.testName}
                </Link>
              </td>
              <td className="px-4 py-3 font-medium">
                {row.resultValue ? `${row.resultValue}${row.unit ? ` ${row.unit}` : ""}` : "—"}
              </td>
              <td className="px-4 py-3 text-muted-foreground">{row.normalRange ?? "—"}</td>
              <td className="px-4 py-3">
                {row.resultStatus ? (
                  <Badge className={STATUS_STYLES[row.resultStatus]}>
                    {STATUS_LABELS[row.resultStatus]}
                  </Badge>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {row.date ? new Date(row.date).toLocaleDateString() : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

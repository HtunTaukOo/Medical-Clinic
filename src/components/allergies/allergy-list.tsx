import { Pill, Utensils, Leaf, ShieldAlert } from "lucide-react";
import { deleteAllergy } from "@/actions/allergies";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";

type AllergyItem = {
  id: string;
  name: string;
  category: "DRUG" | "FOOD" | "ENVIRONMENTAL" | "OTHER";
  reaction: string | null;
  severity: "MILD" | "MODERATE" | "SEVERE";
  firstNoted: Date | null;
};

const CATEGORY_META: Record<
  AllergyItem["category"],
  { label: string; icon: typeof Pill; iconClass: string }
> = {
  DRUG: { label: "Drug", icon: Pill, iconClass: "bg-rose-50 text-rose-600" },
  FOOD: { label: "Food", icon: Utensils, iconClass: "bg-orange-50 text-orange-600" },
  ENVIRONMENTAL: { label: "Environmental", icon: Leaf, iconClass: "bg-emerald-50 text-emerald-600" },
  OTHER: { label: "Other", icon: ShieldAlert, iconClass: "bg-slate-100 text-slate-600" },
};

const SEVERITY_STYLES: Record<AllergyItem["severity"], string> = {
  SEVERE: "bg-red-100 text-red-700",
  MODERATE: "bg-orange-100 text-orange-700",
  MILD: "bg-amber-50 text-amber-700",
};

const SEVERITY_LABELS: Record<AllergyItem["severity"], string> = {
  SEVERE: "Severe",
  MODERATE: "Moderate",
  MILD: "Mild",
};

export function AllergyList({
  allergies,
  canDelete = false,
}: {
  allergies: AllergyItem[];
  canDelete?: boolean;
}) {
  if (allergies.length === 0) {
    return <EmptyState icon={ShieldAlert} message="No allergies recorded." />;
  }

  return (
    <div className="grid gap-3">
      {allergies.map((a) => {
        const meta = CATEGORY_META[a.category];
        const Icon = meta.icon;
        return (
          <div key={a.id} className="flex items-start gap-3 rounded-lg border p-3">
            <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${meta.iconClass}`}>
              <Icon className="size-4" />
            </div>
            <div className="flex-1">
              <p className="font-medium">{a.name}</p>
              <p className="text-sm text-muted-foreground">
                {meta.label}
                {a.reaction && ` · Reaction: ${a.reaction}`}
              </p>
              {a.firstNoted && (
                <p className="text-xs text-muted-foreground">
                  First noted: {new Date(a.firstNoted).toLocaleDateString(undefined, { year: "numeric", month: "short" })}
                </p>
              )}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <Badge className={SEVERITY_STYLES[a.severity]}>{SEVERITY_LABELS[a.severity]}</Badge>
              {canDelete && (
                <form action={deleteAllergy.bind(null, a.id)}>
                  <Button size="sm" variant="ghost" type="submit" className="h-7 px-2 text-xs text-destructive">
                    Remove
                  </Button>
                </form>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

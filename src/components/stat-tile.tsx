import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const COLOR_CLASSES = {
  emerald: "bg-emerald-100 text-emerald-600",
  blue: "bg-blue-100 text-blue-600",
  purple: "bg-purple-100 text-purple-600",
  amber: "bg-amber-100 text-amber-600",
  rose: "bg-rose-100 text-rose-600",
} as const;

export function StatTile({
  icon: Icon,
  value,
  label,
  color,
}: {
  icon: LucideIcon;
  value: string | number;
  label: string;
  color: keyof typeof COLOR_CLASSES;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        <div
          className={`flex size-11 shrink-0 items-center justify-center rounded-full ${COLOR_CLASSES[color]}`}
        >
          <Icon className="size-5" />
        </div>
        <div>
          <p className="text-2xl leading-none font-semibold">{value}</p>
          <p className="mt-1 text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

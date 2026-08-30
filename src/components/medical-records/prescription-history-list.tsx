import { Pill, Clock3, RefreshCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";

type PrescriptionRecord = {
  id: string;
  createdAt: Date;
  fulfilledAt: Date | null;
  doctor: { user: { name: string } };
  medicine: { name: string; brand: string | null };
  dosage: string;
  frequency: string | null;
  timesPerDay: number | null;
  durationDays: number | null;
  instructions: string | null;
  refillsLeft: number | null;
};

function isActive(item: PrescriptionRecord, now: number) {
  if (!item.durationDays) return true;
  const start = (item.fulfilledAt ?? item.createdAt).getTime();
  return start + item.durationDays * 86400000 > now;
}

export function PrescriptionHistoryList({
  items,
  now,
}: {
  items: PrescriptionRecord[];
  now: Date;
}) {
  if (items.length === 0) {
    return <EmptyState icon={Pill} message="No prescriptions yet." />;
  }

  const nowMs = now.getTime();

  return (
    <div className="grid gap-3">
      {items.map((item) => {
        const active = isActive(item, nowMs);
        const frequency = item.frequency ?? (item.timesPerDay ? `${item.timesPerDay}x daily` : null);
        const duration = item.durationDays ? `${item.durationDays} days` : "Ongoing";

        return (
          <Card key={item.id}>
            <CardContent className="grid gap-1.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <span className="font-medium">
                    {item.medicine.name} {item.dosage}
                  </span>
                  {item.medicine.brand && (
                    <span className="ml-1.5 text-sm text-muted-foreground">({item.medicine.brand})</span>
                  )}
                </div>
                <Badge variant={active ? "success" : "outline"}>
                  {active ? "Active" : "Completed"}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {frequency && (
                  <span className="flex items-center gap-1.5">
                    <Clock3 className="size-3.5" />
                    {frequency}
                  </span>
                )}
                <span>{duration}</span>
                {item.refillsLeft != null && (
                  <span className="flex items-center gap-1.5">
                    <RefreshCcw className="size-3.5" />
                    {item.refillsLeft} refill{item.refillsLeft === 1 ? "" : "s"} left
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {item.doctor.user.name} · {new Date(item.createdAt).toLocaleDateString()}
              </p>
              {item.instructions && (
                <p className="text-sm text-muted-foreground italic">{item.instructions}</p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

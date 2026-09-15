"use client";

import { useState, useTransition } from "react";
import {
  forceDeleteDoctor,
  type DoctorHistorySummary,
} from "@/actions/force-delete-doctor-temp";
import { Button } from "@/components/ui/button";

export function ForceDeleteDoctorPanel({ doctors }: { doctors: DoctorHistorySummary[] }) {
  const [pending, startTransition] = useTransition();
  const [results, setResults] = useState<Record<string, string[] | string>>({});
  const [removed, setRemoved] = useState<Set<string>>(new Set());

  return (
    <div className="grid gap-4">
      {doctors.map((d) => {
        const historyCount =
          d.appointmentCount + d.diagnosisCount + d.prescriptionCount + d.labOrderCount + d.walkInCount;
        const isRemoved = removed.has(d.doctorProfileId);
        const result = results[d.doctorProfileId];
        return (
          <div key={d.doctorProfileId} className="rounded-lg border p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold">
                  {d.name} <span className="font-normal text-muted-foreground">— {d.email}</span>
                </p>
                <p className="text-sm text-muted-foreground">{d.specialty ?? "No specialty"}</p>
                <p className="mt-1 text-sm">
                  {historyCount === 0
                    ? "No history — the normal Delete button on /staff/users already works for this doctor."
                    : `${d.appointmentCount} appointment(s), ${d.diagnosisCount} diagnosis(es), ${d.prescriptionCount} prescription(s), ${d.labOrderCount} lab order(s), ${d.walkInCount} walk-in(s)`}
                </p>
              </div>
              {!isRemoved && historyCount > 0 && (
                <Button
                  type="button"
                  variant="destructive"
                  disabled={pending}
                  onClick={() => {
                    const typed = prompt(
                      `This permanently deletes ${d.name} and ALL ${historyCount} of the records above from PRODUCTION. This cannot be undone.\n\nType the doctor's exact name to confirm:`
                    );
                    if (typed !== d.name) {
                      if (typed !== null) alert("Name didn't match — nothing was deleted.");
                      return;
                    }
                    startTransition(async () => {
                      const res = await forceDeleteDoctor(d.doctorProfileId);
                      if (res.error) {
                        setResults((prev) => ({ ...prev, [d.doctorProfileId]: res.error! }));
                      } else {
                        setResults((prev) => ({ ...prev, [d.doctorProfileId]: res.lines ?? [] }));
                        setRemoved((prev) => new Set(prev).add(d.doctorProfileId));
                      }
                    });
                  }}
                >
                  Force Delete
                </Button>
              )}
            </div>
            {result && (
              <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-muted p-3 text-xs whitespace-pre-wrap">
                {Array.isArray(result) ? result.join("\n") : result}
              </pre>
            )}
          </div>
        );
      })}
    </div>
  );
}

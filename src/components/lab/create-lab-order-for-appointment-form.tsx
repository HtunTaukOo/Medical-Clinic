"use client";

import { useActionState, useState } from "react";
import { orderLabTestsByStaff, type StaffOrderLabTestsState } from "@/actions/lab";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

function formatKyat(value: number) {
  return `K ${Math.round(value).toLocaleString()}`;
}

type Test = { id: string; name: string; unit: string | null; normalRange: string | null; price: number };

// Embedded directly in the "Lab Visit — {category}" prompt on the staff
// appointment detail page — patient is already known from the appointment,
// and `tests` only ever contains that category's tests (see
// labTestCategoryFromLabel in src/lib/lab-categories.ts), so staff don't
// have to leave the page and re-search/re-filter through the full catalog
// like the Laboratory page's general "New Test" tab requires.
//
// No referring-doctor picker: a self-booked Lab Visit has no real referring
// physician, so the order is attributed to the same placeholder doctor the
// appointment itself already uses (doctorId, passed straight through) —
// nobody reviews a "doctor" dropdown pick that would've been arbitrary
// anyway. Abnormal results from these orders won't surface on any real
// doctor's dashboard alert as a result; staff catch them via the
// Laboratory page instead.
export function CreateLabOrderForAppointmentForm({
  appointmentId,
  patientId,
  doctorId,
  tests,
}: {
  appointmentId: string;
  patientId: string;
  doctorId: string;
  tests: Test[];
}) {
  const [state, formAction, pending] = useActionState<StaffOrderLabTestsState, FormData>(
    orderLabTestsByStaff,
    {}
  );
  const [selectedTestIds, setSelectedTestIds] = useState<string[]>([]);

  function toggleTest(id: string) {
    setSelectedTestIds((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  }

  const total = tests
    .filter((t) => selectedTestIds.includes(t.id))
    .reduce((sum, t) => sum + t.price, 0);

  function handleSubmit(formData: FormData) {
    if (selectedTestIds.length === 0) return;
    formData.set("patientId", patientId);
    formData.set("doctorId", doctorId);
    formData.set("appointmentId", appointmentId);
    for (const id of selectedTestIds) formData.append("testIds", id);
    return formAction(formData);
  }

  if (state.success && state.orderId) {
    return (
      <p className="text-sm text-emerald-700">
        Lab order created —{" "}
        <Link href={`/staff/lab/${state.orderId}`} className="font-medium underline underline-offset-2">
          view order
        </Link>
        .
      </p>
    );
  }

  return (
    <form action={handleSubmit} className="grid gap-3">
      {tests.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tests in the catalog for this category yet.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {tests.map((test) => (
            <label
              key={test.id}
              className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3 hover:bg-muted/50"
            >
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selectedTestIds.includes(test.id)}
                  onChange={() => toggleTest(test.id)}
                  className="size-4"
                />
                <div>
                  <p className="text-sm font-medium">{test.name}</p>
                  {test.normalRange && (
                    <p className="text-xs text-muted-foreground">Normal: {test.normalRange}</p>
                  )}
                </div>
              </div>
              <span className="text-sm font-medium">{formatKyat(test.price)}</span>
            </label>
          ))}
        </div>
      )}

      {selectedTestIds.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {selectedTestIds.length} test{selectedTestIds.length === 1 ? "" : "s"} · {formatKyat(total)}
        </p>
      )}

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending || selectedTestIds.length === 0} className="w-fit">
        Create Lab Order
      </Button>
    </form>
  );
}

"use client";

function formatKyat(value: number) {
  return `K ${Math.round(value).toLocaleString()}`;
}

type Test = { id: string; name: string; unit: string | null; normalRange: string | null; price: number };

// Shared by RegisterWalkInForm and ConvertWalkInForm — both auto-check the
// patient in the instant the form submits (no REQUESTED step in between),
// so for a Lab Visit category service staff need the chance to pick the
// actual test(s) right here, not only via the follow-up prompt on the
// appointment detail page. Plain uncontrolled checkboxes (shared `name`,
// per-checkbox `value`) so no extra client state is needed — FormData
// collects every checked id under "testIds" on submit, same as
// CreateLabOrderForAppointmentForm's picker. Picking is optional; leaving
// all unchecked just falls back to that follow-up prompt as before.
export function InlineLabTestPicker({ tests }: { tests: Test[] }) {
  if (tests.length === 0) return null;

  return (
    <div className="grid gap-2">
      <p className="text-sm font-medium">
        Lab Test(s) <span className="font-normal text-muted-foreground">(optional — pick now, or leave for later)</span>
      </p>
      <div className="grid max-h-64 gap-2 overflow-y-auto rounded-lg border p-2 sm:grid-cols-2">
        {tests.map((test) => (
          <label
            key={test.id}
            className="flex items-center justify-between gap-3 rounded-lg border bg-card p-2 text-sm hover:bg-muted/50"
          >
            <span className="flex items-center gap-2">
              <input type="checkbox" name="testIds" value={test.id} className="size-4" />
              {test.name}
            </span>
            <span className="text-muted-foreground">{formatKyat(test.price)}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

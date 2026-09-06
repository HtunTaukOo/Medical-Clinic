"use client";

import { useActionState, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { orderLabTestsByStaff, type StaffOrderLabTestsState } from "@/actions/lab";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function formatKyat(value: number) {
  return `K ${Math.round(value).toLocaleString()}`;
}

type Test = { id: string; name: string; unit: string | null; normalRange: string | null; price: number };

export function NewLabOrderForm({
  patients,
  doctors,
  tests,
}: {
  patients: { id: string; name: string }[];
  doctors: { id: string; name: string }[];
  tests: Test[];
}) {
  const [state, formAction, pending] = useActionState<StaffOrderLabTestsState, FormData>(
    orderLabTestsByStaff,
    {}
  );

  const [selectedPatient, setSelectedPatient] = useState<{ id: string; name: string } | null>(
    null
  );
  const [patientQuery, setPatientQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [doctorId, setDoctorId] = useState(doctors[0]?.id ?? "");
  const [selectedTestIds, setSelectedTestIds] = useState<string[]>([]);

  const [dismissed, setDismissed] = useState(false);
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    setDismissed(false);
  }

  const matches = useMemo(() => {
    if (!patientQuery.trim()) return [];
    const q = patientQuery.trim().toLowerCase();
    return patients.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 8);
  }, [patients, patientQuery]);

  function toggleTest(id: string) {
    setSelectedTestIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  }

  const selectedTests = tests.filter((t) => selectedTestIds.includes(t.id));
  const total = selectedTests.reduce((sum, t) => sum + t.price, 0);

  function resetForm() {
    setSelectedPatient(null);
    setPatientQuery("");
    setSelectedTestIds([]);
    setDismissed(true);
  }

  function handleSubmit(formData: FormData) {
    if (!selectedPatient || !doctorId || selectedTestIds.length === 0) return;
    formData.set("patientId", selectedPatient.id);
    formData.set("doctorId", doctorId);
    for (const id of selectedTestIds) formData.append("testIds", id);
    return formAction(formData);
  }

  if (state.success && state.orderId && !dismissed) {
    return (
      <Card>
        <CardContent className="grid justify-items-center gap-4 py-12 text-center">
          <p className="text-lg font-semibold text-emerald-700">Lab order created successfully.</p>
          <div className="flex items-center gap-2">
            <Button asChild>
              <Link href={`/staff/lab/${state.orderId}`}>View Order</Link>
            </Button>
            <Button variant="outline" onClick={resetForm}>
              New Order
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <form action={handleSubmit} className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Patient &amp; Referring Doctor</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Patient</Label>
              <div className="relative">
                <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Search patient..."
                  value={selectedPatient ? selectedPatient.name : patientQuery}
                  onChange={(e) => {
                    setPatientQuery(e.target.value);
                    setSelectedPatient(null);
                    setShowResults(true);
                  }}
                  onFocus={() => setShowResults(true)}
                  onBlur={() => setTimeout(() => setShowResults(false), 150)}
                />
                {showResults && matches.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full rounded-lg border bg-card shadow-md">
                    {matches.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                        onMouseDown={() => {
                          setSelectedPatient(p);
                          setPatientQuery("");
                          setShowResults(false);
                        }}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="doctorId">Referring Doctor</Label>
              <Select value={doctorId} onValueChange={setDoctorId}>
                <SelectTrigger id="doctorId" className="w-full">
                  <SelectValue placeholder="Select doctor" />
                </SelectTrigger>
                <SelectContent>
                  {doctors.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Select Tests</CardTitle>
          </CardHeader>
          <CardContent>
            {tests.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No lab tests in the catalog yet.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {tests.map((test) => (
                  <label
                    key={test.id}
                    className="flex items-center justify-between gap-3 rounded-lg border p-3 hover:bg-muted/50"
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
                          <p className="text-xs text-muted-foreground">
                            Normal: {test.normalRange}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="text-sm font-medium">{formatKyat(test.price)}</span>
                  </label>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="text-base">Order Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Patient</span>
            <span className="font-medium">{selectedPatient?.name ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Doctor</span>
            <span className="font-medium">
              {doctors.find((d) => d.id === doctorId)?.name ?? "—"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Tests</span>
            <span>{selectedTests.length}</span>
          </div>

          {selectedTests.length > 0 && (
            <ul className="grid gap-1 border-t pt-3">
              {selectedTests.map((t) => (
                <li key={t.id} className="flex items-center justify-between text-muted-foreground">
                  <span>{t.name}</span>
                  <span>{formatKyat(t.price)}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center justify-between border-t pt-3 text-lg font-bold">
            <span>TOTAL</span>
            <span className="text-primary">{formatKyat(total)}</span>
          </div>

          {state.error && <p className="text-sm text-destructive">{state.error}</p>}

          <Button
            type="submit"
            size="lg"
            disabled={pending || !selectedPatient || !doctorId || selectedTestIds.length === 0}
          >
            Create Order
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}

"use client";

import { useActionState, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { createExternalLabReferral, type CreateExternalLabReferralState } from "@/actions/external-lab";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LAB_TEST_CATEGORIES, LAB_TEST_CATEGORY_LABELS } from "@/lib/lab-categories";

type Test = {
  id: string;
  name: string;
  normalRange: string | null;
  category: (typeof LAB_TEST_CATEGORIES)[number];
  requiresExternalLab: boolean;
};

// datetime-local inputs want "YYYY-MM-DDTHH:mm" in the viewer's local time,
// not UTC (toISOString() alone would shift it) — offset-adjust first.
function nowLocalInputValue() {
  const d = new Date();
  const offsetMs = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function NewExternalLabReferralForm({
  patients,
  tests,
  referredLabNames,
}: {
  patients: { id: string; name: string }[];
  tests: Test[];
  referredLabNames: string[];
}) {
  const [state, formAction, pending] = useActionState<CreateExternalLabReferralState, FormData>(
    createExternalLabReferral,
    {}
  );

  const [selectedPatient, setSelectedPatient] = useState<{ id: string; name: string } | null>(null);
  const [patientQuery, setPatientQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [selectedTestId, setSelectedTestId] = useState("");
  const [defaultNow] = useState(nowLocalInputValue);

  const [justCreated, setJustCreated] = useState(false);
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state.success) {
      setSelectedPatient(null);
      setPatientQuery("");
      setSelectedTestId("");
      setJustCreated(true);
    }
  }

  const matches = useMemo(() => {
    if (!patientQuery.trim()) return [];
    const q = patientQuery.trim().toLowerCase();
    return patients.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 8);
  }, [patients, patientQuery]);

  const selectedTest = tests.find((t) => t.id === selectedTestId) ?? null;

  function handleSubmit(formData: FormData) {
    if (!selectedPatient || !selectedTestId) return;
    formData.set("patientId", selectedPatient.id);
    formData.append("testIds", selectedTestId);
    return formAction(formData);
  }

  return (
    <form action={handleSubmit} className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <Card className="relative z-20 h-fit overflow-visible">
        <CardHeader>
          <CardTitle className="text-base">External Lab Referral</CardTitle>
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
                  setJustCreated(false);
                }}
                onFocus={() => setShowResults(true)}
                onBlur={() => setTimeout(() => setShowResults(false), 150)}
              />
              {showResults && matches.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border bg-card shadow-md">
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
            <Label htmlFor="testId">Requested Test</Label>
            <Select value={selectedTestId} onValueChange={(v) => { setSelectedTestId(v); setJustCreated(false); }}>
              <SelectTrigger id="testId" className="w-full">
                <SelectValue placeholder="Select a test" />
              </SelectTrigger>
              <SelectContent>
                {LAB_TEST_CATEGORIES.map((category) => {
                  const testsInCategory = tests
                    .filter((t) => t.category === category)
                    .sort((a, b) => Number(b.requiresExternalLab) - Number(a.requiresExternalLab));
                  if (testsInCategory.length === 0) return null;
                  return (
                    <SelectGroup key={category}>
                      <SelectLabel>{LAB_TEST_CATEGORY_LABELS[category]}</SelectLabel>
                      {testsInCategory.map((test) => (
                        <SelectItem key={test.id} value={test.id}>
                          {test.name}
                          {test.requiresExternalLab ? " — Sent externally" : ""}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  );
                })}
              </SelectContent>
            </Select>
            {selectedTest?.requiresExternalLab && (
              <p className="text-xs font-medium text-amber-700">
                This test is known to need an outside lab.
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="referredLabName">Referred Lab</Label>
            <Input
              id="referredLabName"
              name="referredLabName"
              list="referred-lab-names"
              placeholder="e.g. City Diagnostic Lab"
              required
            />
            <datalist id="referred-lab-names">
              {referredLabNames.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>
          <div />

          <div className="grid gap-2">
            <Label htmlFor="sampleCollectedAt">Sample Collected At</Label>
            <Input
              id="sampleCollectedAt"
              name="sampleCollectedAt"
              type="datetime-local"
              defaultValue={defaultNow}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="requestedAt">Request Time</Label>
            <Input id="requestedAt" name="requestedAt" type="datetime-local" defaultValue={defaultNow} required />
          </div>

          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea id="notes" name="notes" rows={2} placeholder="Anything staff should know about this referral" />
          </div>
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="text-base">Referral Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Patient</span>
            <span className="font-medium">{selectedPatient?.name ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Test</span>
            <span className="font-medium">{selectedTest?.name ?? "—"}</span>
          </div>

          {justCreated && <p className="text-sm font-medium text-emerald-700">Referral created.</p>}
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}

          <Button type="submit" size="lg" disabled={pending || !selectedPatient || !selectedTestId}>
            Log Referral
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}

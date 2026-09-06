"use client";

import { useActionState, useMemo, useState } from "react";
import { AlertTriangle, Search, X } from "lucide-react";
import { completeSale, type CompleteSaleState } from "@/actions/pharmacy";
import { rxCode } from "@/lib/pharmacy";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function formatKyat(value: number) {
  return `K ${Math.round(value).toLocaleString()}`;
}

type RxPatient = { id: string; name: string; dob: string | null; phone: string | null };
type RxItem = {
  id: string;
  dosage: string;
  quantity: number | null;
  medicine: { id: string; name: string; price: number; unit: string };
};
type PendingRx = { id: string; createdAt: string; patient: RxPatient; items: RxItem[] };
type Medicine = { id: string; name: string; price: number; unit: string; stockQty: number };
type SaleItem = {
  medicineId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  source: "rx" | "otc";
};

const PAYMENT_METHODS = [
  { value: "CASH", label: "Cash" },
  { value: "CARD", label: "Card" },
  { value: "INSURANCE", label: "Insurance" },
] as const;

function findRx(list: PendingRx[], code: string) {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return null;
  return list.find((rx) => rxCode(rx.id, new Date(rx.createdAt)).toUpperCase() === trimmed) ?? null;
}

export function NewSaleForm({
  pendingPrescriptions,
  medicines,
  patients,
  initialRxCode,
}: {
  pendingPrescriptions: PendingRx[];
  medicines: Medicine[];
  patients: { id: string; name: string }[];
  initialRxCode?: string;
}) {
  const [state, formAction, pending] = useActionState<CompleteSaleState, FormData>(completeSale, {});

  const [rxInput, setRxInput] = useState(initialRxCode ?? "");
  const [resolvedRx, setResolvedRx] = useState<PendingRx | null>(() =>
    initialRxCode ? findRx(pendingPrescriptions, initialRxCode) : null
  );
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [items, setItems] = useState<SaleItem[]>(() => {
    const initial = initialRxCode ? findRx(pendingPrescriptions, initialRxCode) : null;
    return initial
      ? initial.items.map((item) => ({
          medicineId: item.medicine.id,
          name: `${item.medicine.name} (${item.dosage})`,
          quantity: item.quantity ?? 1,
          unitPrice: item.medicine.price,
          source: "rx" as const,
        }))
      : [];
  });

  const [selectedPatient, setSelectedPatient] = useState<{ id: string; name: string } | null>(
    null
  );
  const [patientQuery, setPatientQuery] = useState("");
  const [showPatientResults, setShowPatientResults] = useState(false);

  const [otcQuery, setOtcQuery] = useState("");
  const [showOtcResults, setShowOtcResults] = useState(false);

  const [discount, setDiscount] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState<(typeof PAYMENT_METHODS)[number]["value"]>(
    "CASH"
  );

  const [dismissed, setDismissed] = useState(false);
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    setDismissed(false);
  }

  const patient = resolvedRx?.patient ?? selectedPatient;

  const patientMatches = useMemo(() => {
    if (!patientQuery.trim()) return [];
    const q = patientQuery.trim().toLowerCase();
    return patients.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 8);
  }, [patients, patientQuery]);

  const otcMatches = useMemo(() => {
    if (!otcQuery.trim()) return [];
    const q = otcQuery.trim().toLowerCase();
    return medicines.filter((m) => m.name.toLowerCase().includes(q)).slice(0, 8);
  }, [medicines, otcQuery]);

  function handleLookup() {
    const match = findRx(pendingPrescriptions, rxInput);
    if (!match) {
      setResolvedRx(null);
      setItems((prev) => prev.filter((i) => i.source !== "rx"));
      setLookupError(`No pending prescription found for "${rxInput}".`);
      return;
    }
    setLookupError(null);
    setResolvedRx(match);
    setSelectedPatient(null);
    setItems((prev) => [
      ...match.items.map((item) => ({
        medicineId: item.medicine.id,
        name: `${item.medicine.name} (${item.dosage})`,
        quantity: item.quantity ?? 1,
        unitPrice: item.medicine.price,
        source: "rx" as const,
      })),
      ...prev.filter((i) => i.source !== "rx"),
    ]);
  }

  function addOtcItem(medicine: Medicine) {
    setItems((prev) => {
      const existing = prev.find((i) => i.medicineId === medicine.id);
      if (existing) {
        return prev.map((i) =>
          i.medicineId === medicine.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        { medicineId: medicine.id, name: medicine.name, quantity: 1, unitPrice: medicine.price, source: "otc" },
      ];
    });
    setOtcQuery("");
    setShowOtcResults(false);
  }

  function updateQuantity(medicineId: string, quantity: number) {
    setItems((prev) =>
      prev.map((i) => (i.medicineId === medicineId ? { ...i, quantity: Math.max(1, quantity) } : i))
    );
  }

  function removeItem(medicineId: string) {
    setItems((prev) => prev.filter((i) => i.medicineId !== medicineId));
  }

  function resetSale() {
    setRxInput("");
    setResolvedRx(null);
    setLookupError(null);
    setItems([]);
    setSelectedPatient(null);
    setPatientQuery("");
    setDiscount("0");
    setPaymentMethod("CASH");
    setDismissed(true);
  }

  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const discountValue = Number(discount) || 0;
  const total = Math.max(0, subtotal - discountValue);

  function handleSubmit(formData: FormData) {
    if (!patient || items.length === 0) return;
    formData.set("patientId", patient.id);
    if (resolvedRx) formData.set("prescriptionId", resolvedRx.id);
    formData.set(
      "items",
      JSON.stringify(items.map(({ medicineId, name, quantity, unitPrice }) => ({ medicineId, name, quantity, unitPrice })))
    );
    formData.set("discount", String(discountValue));
    formData.set("paymentMethod", paymentMethod);
    return formAction(formData);
  }

  if (state.success && state.saleId && !dismissed) {
    return (
      <Card>
        <CardContent className="grid justify-items-center gap-4 py-12 text-center">
          <p className="text-lg font-semibold text-emerald-700">Sale completed successfully.</p>
          <p className="text-sm text-muted-foreground">
            {formatKyat(total)} charged to {patient?.name}.
          </p>
          <div className="flex items-center gap-2">
            <Button asChild>
              <Link href={`/pharmacy-receipt/${state.saleId}`} target="_blank">
                Print Receipt
              </Link>
            </Button>
            <Button variant="outline" onClick={resetSale}>
              New Sale
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
            <CardTitle className="text-base">Prescription Reference</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex items-center gap-2">
              <Input
                placeholder="RX-2026-0841"
                value={rxInput}
                onChange={(e) => setRxInput(e.target.value)}
              />
              <Button type="button" onClick={handleLookup}>
                Look Up
              </Button>
            </div>
            {lookupError && <p className="text-sm text-destructive">{lookupError}</p>}

            {resolvedRx && (
              <div className="grid gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-primary">Patient Information</p>
                  <span className="text-xs text-muted-foreground">
                    Rx: {rxCode(resolvedRx.id, new Date(resolvedRx.createdAt))}
                  </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Patient</p>
                    <p className="font-medium">{resolvedRx.patient.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">DOB</p>
                    <p className="font-medium">
                      {resolvedRx.patient.dob
                        ? new Date(resolvedRx.patient.dob).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Phone</p>
                    <p className="font-medium">{resolvedRx.patient.phone ?? "—"}</p>
                  </div>
                </div>
                <div className="rounded-md border bg-card p-3">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                    Prescribed Medicines
                  </p>
                  <ul className="grid gap-1 text-sm">
                    {resolvedRx.items.map((item) => (
                      <li key={item.id}>
                        {item.medicine.name} &middot; {item.dosage}
                        {item.quantity != null && (
                          <span className="text-muted-foreground"> · {item.quantity} {item.medicine.unit}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {!resolvedRx && (
              <div className="grid gap-2">
                <Label>Patient</Label>
                <div className="relative">
                  <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-8"
                    placeholder="Search patient for this sale..."
                    value={selectedPatient ? selectedPatient.name : patientQuery}
                    onChange={(e) => {
                      setPatientQuery(e.target.value);
                      setSelectedPatient(null);
                      setShowPatientResults(true);
                    }}
                    onFocus={() => setShowPatientResults(true)}
                    onBlur={() => setTimeout(() => setShowPatientResults(false), 150)}
                  />
                  {showPatientResults && patientMatches.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full rounded-lg border bg-card shadow-md">
                      {patientMatches.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                          onMouseDown={() => {
                            setSelectedPatient(p);
                            setPatientQuery("");
                            setShowPatientResults(false);
                          }}
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add OTC Item</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Search medicine to add..."
                  value={otcQuery}
                  onChange={(e) => {
                    setOtcQuery(e.target.value);
                    setShowOtcResults(true);
                  }}
                  onFocus={() => setShowOtcResults(true)}
                  onBlur={() => setTimeout(() => setShowOtcResults(false), 150)}
                />
                {showOtcResults && otcMatches.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full rounded-lg border bg-card shadow-md">
                    {otcMatches.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
                        onMouseDown={() => addOtcItem(m)}
                      >
                        <span>{m.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatKyat(m.price)} · {m.stockQty} {m.unit}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sale Items</CardTitle>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Look up a prescription or add an OTC item to begin.
              </p>
            ) : (
              <div className="grid gap-2">
                {items.map((item) => (
                  <div
                    key={item.medicineId}
                    className="flex items-center justify-between gap-3 rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatKyat(item.unitPrice)} each ·{" "}
                        {item.source === "rx" ? "Prescribed" : "OTC"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => updateQuantity(item.medicineId, Number(e.target.value) || 1)}
                        className="w-16"
                      />
                      <span className="w-20 text-right font-medium">
                        {formatKyat(item.quantity * item.unitPrice)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeItem(item.medicineId)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="text-base">Sale Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Patient</span>
            <span className="font-medium">{patient?.name ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Rx #</span>
            <span className="font-medium text-primary">
              {resolvedRx ? rxCode(resolvedRx.id, new Date(resolvedRx.createdAt)) : "OTC"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Items</span>
            <span>{items.length}</span>
          </div>

          <div className="grid gap-2 border-t pt-3">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatKyat(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Discount</span>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">K</span>
                <Input
                  type="number"
                  min={0}
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className="h-7 w-20 text-right"
                />
              </div>
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Tax</span>
              <span>K 0</span>
            </div>
          </div>

          <div className="flex items-center justify-between border-t pt-3 text-lg font-bold">
            <span>TOTAL</span>
            <span className="text-primary">{formatKyat(total)}</span>
          </div>

          <div className="grid gap-2 border-t pt-3">
            <Label>Payment Method</Label>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setPaymentMethod(m.value)}
                  className={
                    paymentMethod === m.value
                      ? "rounded-md bg-primary py-1.5 text-sm font-medium text-primary-foreground"
                      : "rounded-md border py-1.5 text-sm font-medium hover:bg-muted"
                  }
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {state.error && <p className="text-sm text-destructive">{state.error}</p>}

          <Button type="submit" size="lg" disabled={pending || !patient || items.length === 0}>
            Complete Sale
          </Button>
          <Button type="button" variant="outline" disabled>
            Print Receipt
          </Button>

          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              Sell only prescribed medicines in approved quantities. Verify patient identity
              before dispensing.
            </span>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}

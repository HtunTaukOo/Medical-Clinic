"use client";

import { useActionState, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { createInvoice, type InvoiceFormState } from "@/actions/billing";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function formatKyat(value: number) {
  return `MMK ${Math.round(value).toLocaleString()}`;
}

const PAYMENT_METHODS = ["CASH", "CARD", "MOBILE_BANKING", "OTHER"] as const;
const PAYMENT_METHOD_KEYS = { CASH: "cash", CARD: "card", MOBILE_BANKING: "mobileBanking", OTHER: "other" } as const;

export function InvoiceForm({
  patients,
  lockedPatient,
  appointmentId,
  redirectOnSuccess = "/staff/billing",
  defaultConsultationFee,
  nextInvoiceNumber,
  packages,
}: {
  patients?: { id: string; name: string }[];
  lockedPatient?: { id: string; name: string };
  appointmentId?: string;
  redirectOnSuccess?: string;
  defaultConsultationFee?: number;
  nextInvoiceNumber?: number;
  packages?: { id: string; name: string; price: number }[];
}) {
  const t = useTranslations("billing");
  const router = useRouter();
  const [state, formAction, pending] = useActionState<InvoiceFormState, FormData>(
    createInvoice,
    {}
  );

  const [selectedPatient, setSelectedPatient] = useState(lockedPatient ?? null);
  const [patientQuery, setPatientQuery] = useState(lockedPatient?.name ?? "");
  const [showResults, setShowResults] = useState(false);

  const [consultationFee, setConsultationFee] = useState(
    defaultConsultationFee ? String(defaultConsultationFee) : "0"
  );
  const [medicineCharges, setMedicineCharges] = useState("0");
  const [labCharges, setLabCharges] = useState("0");
  const [packageCharges, setPackageCharges] = useState("0");
  const [packageName, setPackageName] = useState<string | null>(null);
  const [discount, setDiscount] = useState("0");
  const [amountPaid, setAmountPaid] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState<(typeof PAYMENT_METHODS)[number]>("CASH");

  // Derived during render (not an effect): the form remounts on success,
  // resetting `state` back to {}, so we navigate away the instant a fresh
  // success is observed rather than reacting to it after the fact.
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state.success) router.push(redirectOnSuccess);
  }

  const matches = useMemo(() => {
    if (!patients || !patientQuery.trim()) return [];
    const q = patientQuery.trim().toLowerCase();
    return patients.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 8);
  }, [patients, patientQuery]);

  const fee = Number(consultationFee) || 0;
  const medicine = Number(medicineCharges) || 0;
  const lab = Number(labCharges) || 0;
  const pkg = Number(packageCharges) || 0;
  const discountValue = Number(discount) || 0;
  const paid = Number(amountPaid) || 0;

  const subtotal = fee + medicine + lab + pkg;
  const total = Math.max(0, subtotal - discountValue);
  const balanceDue = Math.max(0, total - paid);
  const invoiceStatus = total === 0 ? "UNPAID" : balanceDue === 0 ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID";
  const STATUS_STYLES: Record<string, string> = {
    PAID: "bg-emerald-100 text-emerald-700",
    PARTIAL: "bg-amber-100 text-amber-700",
    UNPAID: "bg-rose-100 text-rose-700",
  };

  function handleSubmit(formData: FormData) {
    const items = [
      fee > 0 ? { description: "Consultation Fee", quantity: 1, unitPrice: fee } : null,
      medicine > 0 ? { description: "Medicine Charges", quantity: 1, unitPrice: medicine } : null,
      lab > 0 ? { description: "Lab / Service Charges", quantity: 1, unitPrice: lab } : null,
      pkg > 0 ? { description: packageName ?? "Package Charges", quantity: 1, unitPrice: pkg } : null,
      discountValue > 0
        ? { description: "Discount", quantity: 1, unitPrice: -discountValue }
        : null,
    ].filter((item): item is { description: string; quantity: number; unitPrice: number } =>
      Boolean(item)
    );
    formData.set("items", JSON.stringify(items));
    if (selectedPatient) formData.set("patientId", selectedPatient.id);
    formData.set("amountPaid", String(paid));
    formData.set("paymentMethod", paymentMethod);
    return formAction(formData);
  }

  const today = new Date();

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <Card className="relative z-20 overflow-visible">
        <CardHeader>
          <CardTitle>{t("newInvoice")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={handleSubmit} className="grid gap-4">
            {appointmentId && <input type="hidden" name="appointmentId" value={appointmentId} />}

            <div className="grid gap-2">
              <Label>{t("patient")}</Label>
              {lockedPatient ? (
                <p className="font-medium">{lockedPatient.name}</p>
              ) : (
                <div className="relative">
                  <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-8"
                    placeholder={t("patient")}
                    value={patientQuery}
                    onChange={(e) => {
                      setPatientQuery(e.target.value);
                      setSelectedPatient(null);
                      setShowResults(true);
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
                            setPatientQuery(p.name);
                            setShowResults(false);
                          }}
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="consultationFee">{t("consultationFee")}</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">K</span>
                <Input
                  id="consultationFee"
                  type="number"
                  min={0}
                  step="0.01"
                  value={consultationFee}
                  onChange={(e) => setConsultationFee(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="medicineCharges">{t("medicineCharges")}</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">K</span>
                <Input
                  id="medicineCharges"
                  type="number"
                  min={0}
                  step="0.01"
                  value={medicineCharges}
                  onChange={(e) => setMedicineCharges(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="labCharges">{t("labServiceCharges")}</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">K</span>
                <Input
                  id="labCharges"
                  type="number"
                  min={0}
                  step="0.01"
                  value={labCharges}
                  onChange={(e) => setLabCharges(e.target.value)}
                />
              </div>
            </div>

            {packages && packages.length > 0 && (
              <div className="grid gap-2">
                <Label htmlFor="packageSelect">{t("packages")}</Label>
                <Select
                  value=""
                  onValueChange={(id) => {
                    const selected = packages.find((p) => p.id === id);
                    if (!selected) return;
                    setPackageCharges(String(selected.price));
                    setPackageName(selected.name);
                  }}
                >
                  <SelectTrigger id="packageSelect" className="w-full">
                    <SelectValue placeholder={t("addPackagePlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {packages.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} — {formatKyat(p.price)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {pkg > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">K</span>
                    <Input
                      id="packageCharges"
                      type="number"
                      min={0}
                      step="0.01"
                      value={packageCharges}
                      onChange={(e) => setPackageCharges(e.target.value)}
                    />
                  </div>
                )}
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="discount">{t("discount")}</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">K</span>
                <Input
                  id="discount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-1 border-t pt-4 text-sm">
              <div className="flex items-center justify-between text-muted-foreground">
                <span>{t("subtotal")}</span>
                <span>{formatKyat(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>{t("tax")}</span>
                <span>0%</span>
              </div>
              <div className="flex items-center justify-between text-lg font-bold">
                <span>{t("total")}</span>
                <span className="text-orange-600">{formatKyat(total)}</span>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="amountPaid">{t("amountPaid")}</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">K</span>
                <Input
                  id="amountPaid"
                  type="number"
                  min={0}
                  step="0.01"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="paymentMethod">{t("paymentMethod")}</Label>
              <Select
                value={paymentMethod}
                onValueChange={(v) => setPaymentMethod(v as (typeof PAYMENT_METHODS)[number])}
              >
                <SelectTrigger id="paymentMethod" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {t(PAYMENT_METHOD_KEYS[m])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {state.error && <p className="text-sm text-destructive">{state.error}</p>}
            <Button type="submit" disabled={pending || !selectedPatient} className="w-fit">
              {t("newInvoice")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle>{t("invoicePreview")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t("invoiceNo")}</span>
            <span className="font-medium text-primary">
              INV-{String(nextInvoiceNumber ?? 0).padStart(4, "0")}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t("date")}</span>
            <span>
              {today.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t("patient")}</span>
            <span>{selectedPatient?.name ?? "—"}</span>
          </div>

          <div className="grid gap-1 border-t pt-3">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("consultation")}</span>
              <span>{formatKyat(fee)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("medicine")}</span>
              <span>{formatKyat(medicine)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("lab")}</span>
              <span>{formatKyat(lab)}</span>
            </div>
            {pkg > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{packageName ?? t("packages")}</span>
                <span>{formatKyat(pkg)}</span>
              </div>
            )}
            {discountValue > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("discount")}</span>
                <span>-{formatKyat(discountValue)}</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t pt-3 font-bold">
            <span>{t("total")}</span>
            <span>{formatKyat(total)}</span>
          </div>
          <div className="flex items-center justify-between font-semibold text-rose-600">
            <span>{t("balanceDue")}</span>
            <span>{formatKyat(balanceDue)}</span>
          </div>

          <div className="flex items-center justify-between border-t pt-3">
            <span className="text-muted-foreground">{t("status")}</span>
            <Badge variant="outline" className={STATUS_STYLES[invoiceStatus]}>
              {invoiceStatus === "PAID" ? t("paid") : invoiceStatus === "PARTIAL" ? t("partial") : t("unpaid")}
            </Badge>
          </div>
          {paid > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("payment")}</span>
              <span>{t(PAYMENT_METHOD_KEYS[paymentMethod])}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

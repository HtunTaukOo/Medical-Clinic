"use client";

import { useActionState } from "react";
import { ShieldCheck } from "lucide-react";
import { updateInsuranceInfo, type PatientFormState } from "@/actions/patients";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export function InsuranceForm({
  defaultValues,
}: {
  defaultValues: {
    insuranceProvider: string;
    insurancePolicyNumber: string;
    insuranceGroupNumber: string;
    insuranceCoverageType: string;
    insurancePolicyHolder: string;
    insuranceExpiryDate: string;
  };
}) {
  const [state, formAction, pending] = useActionState<PatientFormState, FormData>(
    updateInsuranceInfo,
    {}
  );

  const isExpired =
    !!defaultValues.insuranceExpiryDate && new Date(defaultValues.insuranceExpiryDate) < new Date();

  return (
    <form action={formAction} className="grid gap-4">
      {defaultValues.insuranceProvider && (
        <div className="flex items-center gap-3 rounded-lg border bg-blue-50/60 p-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
            <ShieldCheck className="size-4" />
          </div>
          <div className="flex-1">
            <p className="font-medium">
              {defaultValues.insuranceProvider}
              {defaultValues.insuranceCoverageType ? ` — ${defaultValues.insuranceCoverageType}` : ""}
            </p>
            <p className="text-sm text-muted-foreground">
              {defaultValues.insuranceExpiryDate
                ? `Policy ${isExpired ? "expired" : "active"} · Expires ${new Date(
                    defaultValues.insuranceExpiryDate
                  ).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
                : "Policy on file"}
            </p>
          </div>
          <Badge variant={isExpired ? "outline" : "success"}>
            {isExpired ? "Expired" : "Active"}
          </Badge>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="insuranceProvider">Insurance Provider</Label>
          <Input
            id="insuranceProvider"
            name="insuranceProvider"
            defaultValue={defaultValues.insuranceProvider}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="insurancePolicyNumber">Policy Number</Label>
          <Input
            id="insurancePolicyNumber"
            name="insurancePolicyNumber"
            defaultValue={defaultValues.insurancePolicyNumber}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="insuranceGroupNumber">Group Number</Label>
          <Input
            id="insuranceGroupNumber"
            name="insuranceGroupNumber"
            defaultValue={defaultValues.insuranceGroupNumber}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="insuranceCoverageType">Coverage Type</Label>
          <Input
            id="insuranceCoverageType"
            name="insuranceCoverageType"
            defaultValue={defaultValues.insuranceCoverageType}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="insurancePolicyHolder">Policy Holder</Label>
          <Input
            id="insurancePolicyHolder"
            name="insurancePolicyHolder"
            defaultValue={defaultValues.insurancePolicyHolder}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="insuranceExpiryDate">Expiry Date</Label>
          <Input
            id="insuranceExpiryDate"
            name="insuranceExpiryDate"
            type="date"
            defaultValue={defaultValues.insuranceExpiryDate}
          />
        </div>
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && <p className="text-sm text-muted-foreground">Saved.</p>}
      <Button type="submit" disabled={pending} className="w-fit">
        Save Changes
      </Button>
    </form>
  );
}

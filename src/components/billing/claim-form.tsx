"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { submitClaim, type ClaimFormState } from "@/actions/insurance-claims";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ClaimForm({
  invoiceId,
  defaultProvider,
  defaultPolicyNumber,
  defaultAmount,
}: {
  invoiceId: string;
  defaultProvider?: string | null;
  defaultPolicyNumber?: string | null;
  defaultAmount: number;
}) {
  const t = useTranslations("billing");
  const boundAction = submitClaim.bind(null, invoiceId);
  const [state, formAction, pending] = useActionState<ClaimFormState, FormData>(
    boundAction,
    {}
  );

  return (
    <form
      action={formAction}
      key={state.success ? "reset" : "form"}
      className="grid gap-3"
    >
      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-1.5">
          <Label htmlFor="claim-provider">{t("insuranceProvider")}</Label>
          <Input
            id="claim-provider"
            name="insuranceProvider"
            required
            defaultValue={defaultProvider ?? ""}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="claim-policy">{t("policyNumber")}</Label>
          <Input
            id="claim-policy"
            name="policyNumber"
            required
            defaultValue={defaultPolicyNumber ?? ""}
          />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="claim-amount">{t("claimedAmount")}</Label>
        <Input
          id="claim-amount"
          name="claimedAmount"
          type="number"
          min={0.01}
          step="0.01"
          required
          defaultValue={defaultAmount.toFixed(2)}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="claim-notes">{t("claimNotes")}</Label>
        <Input id="claim-notes" name="notes" />
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending} className="w-fit">
        {t("submitClaim")}
      </Button>
    </form>
  );
}

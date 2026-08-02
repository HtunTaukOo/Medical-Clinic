"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { decideClaim, type ClaimDecisionState } from "@/actions/insurance-claims";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ClaimDecisionForm({
  claimId,
  claimedAmount,
}: {
  claimId: string;
  claimedAmount: number;
}) {
  const t = useTranslations("billing");
  const boundAction = decideClaim.bind(null, claimId);
  const [state, formAction, pending] = useActionState<ClaimDecisionState, FormData>(
    boundAction,
    {}
  );

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <Input
        name="approvedAmount"
        type="number"
        min={0.01}
        max={claimedAmount}
        step="0.01"
        defaultValue={claimedAmount.toFixed(2)}
        className="w-24"
      />
      <Input name="notes" placeholder={t("claimNotes")} className="w-40" />
      <Button type="submit" name="status" value="APPROVED" size="sm" disabled={pending}>
        {t("approve")}
      </Button>
      <Button
        type="submit"
        name="status"
        value="REJECTED"
        size="sm"
        variant="destructive"
        disabled={pending}
      >
        {t("reject")}
      </Button>
      {state.error && <span className="text-sm text-destructive">{state.error}</span>}
    </form>
  );
}

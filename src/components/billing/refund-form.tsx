"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { refundPayment, type RefundFormState } from "@/actions/billing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function RefundForm({
  invoiceId,
  paymentId,
  maxAmount,
}: {
  invoiceId: string;
  paymentId: string;
  maxAmount: number;
}) {
  const t = useTranslations("billing");
  const boundAction = refundPayment.bind(null, invoiceId, paymentId);
  const [state, formAction, pending] = useActionState<RefundFormState, FormData>(
    boundAction,
    {}
  );

  if (maxAmount <= 0) return null;

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <Input
        id={`refund-amount-${paymentId}`}
        name="amount"
        type="number"
        min={0.01}
        max={maxAmount}
        step="0.01"
        defaultValue={maxAmount.toFixed(2)}
        className="w-24"
        required
      />
      <Input name="reason" placeholder={t("refundReason")} className="w-40" />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {t("refund")}
      </Button>
      {state.error && <span className="text-sm text-destructive">{state.error}</span>}
    </form>
  );
}

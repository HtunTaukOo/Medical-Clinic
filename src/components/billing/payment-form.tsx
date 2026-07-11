"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import type { PaymentFormState } from "@/actions/billing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const METHODS = ["CASH", "CARD", "MOBILE_BANKING", "OTHER"] as const;

export function PaymentForm({
  action,
}: {
  action: (
    state: PaymentFormState,
    formData: FormData
  ) => Promise<PaymentFormState>;
}) {
  const t = useTranslations("billing");
  const [state, formAction, pending] = useActionState<
    PaymentFormState,
    FormData
  >(action, {});

  return (
    <form action={formAction} className="grid max-w-sm gap-4">
      <div className="grid gap-2">
        <Label htmlFor="amount">{t("amount")}</Label>
        <Input id="amount" name="amount" type="number" min={0.01} step="0.01" required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="method">{t("method")}</Label>
        <Select name="method" defaultValue="CASH">
          <SelectTrigger id="method" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {METHODS.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending} className="w-fit">
        {t("recordPayment")}
      </Button>
    </form>
  );
}

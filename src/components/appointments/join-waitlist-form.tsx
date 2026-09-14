"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { joinWaitlist, type WaitlistFormState } from "@/actions/waitlist";
import { Button } from "@/components/ui/button";

export function JoinWaitlistForm({
  doctorId,
  scheduledAt,
  reason,
}: {
  doctorId: string;
  scheduledAt: string;
  reason?: string;
}) {
  const t = useTranslations("portal.waitlistForm");
  const [state, formAction, pending] = useActionState<WaitlistFormState, FormData>(
    joinWaitlist,
    {}
  );

  if (state.success) {
    return <p className="text-sm text-emerald-600">{t("onWaitlist")}</p>;
  }

  return (
    <form action={formAction} className="mt-1 flex flex-col items-start gap-1">
      <input type="hidden" name="doctorId" value={doctorId} />
      <input type="hidden" name="scheduledAt" value={scheduledAt} />
      {reason && <input type="hidden" name="reason" value={reason} />}
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {t("join")}
      </Button>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}

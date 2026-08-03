"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { registerWalkIn, type RegisterWalkInState } from "@/actions/walk-ins";
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

export function WalkInForm({ doctors }: { doctors: { id: string; name: string }[] }) {
  const t = useTranslations("appointments");
  const [state, formAction, pending] = useActionState<RegisterWalkInState, FormData>(
    registerWalkIn,
    {}
  );
  const [lastToken, setLastToken] = useState<number | null>(null);
  const [handledState, setHandledState] = useState(state);

  // Derived during render (not an effect): the form remounts on success,
  // resetting `state` back to {}, so the issued token needs to be captured
  // into state that survives that remount before it's lost.
  if (state !== handledState) {
    setHandledState(state);
    if (state.success && state.tokenNumber) setLastToken(state.tokenNumber);
  }

  return (
    <div className="grid gap-3">
      {lastToken !== null && (
        <p className="rounded-lg bg-secondary p-3 text-sm font-medium text-secondary-foreground">
          {t("tokenIssued", { token: lastToken })}
        </p>
      )}
      <form
        action={formAction}
        key={state.success ? "reset" : "form"}
        className="flex flex-wrap items-end gap-2"
      >
        <div className="grid gap-1">
          <Label className="text-xs text-muted-foreground">{t("walkInName")}</Label>
          <Input name="name" className="w-40" />
        </div>
        <div className="grid gap-1">
          <Label className="text-xs text-muted-foreground">{t("walkInPhone")}</Label>
          <Input name="phone" className="w-36" />
        </div>
        <div className="grid gap-1">
          <Label className="text-xs text-muted-foreground">{t("walkInReason")}</Label>
          <Input name="reason" className="w-40" />
        </div>
        <div className="grid gap-1">
          <Label className="text-xs text-muted-foreground">{t("walkInDoctor")}</Label>
          <Select name="doctorId">
            <SelectTrigger className="w-40">
              <SelectValue placeholder={t("anyDoctor")} />
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
        {state.error && <p className="text-sm text-destructive">{state.error}</p>}
        <Button type="submit" disabled={pending}>
          {t("registerWalkIn")}
        </Button>
      </form>
    </div>
  );
}

"use client";

import { useActionState } from "react";
import { updateClinicNotifications, type ClinicSettingsFormState } from "@/actions/clinic-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ClinicNotificationsForm({
  staffTelegramChatId,
}: {
  staffTelegramChatId: string | null;
}) {
  const [state, formAction, pending] = useActionState<ClinicSettingsFormState, FormData>(
    updateClinicNotifications,
    {}
  );

  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="staffTelegramChatId">Staff Telegram chat ID</Label>
        <Input
          id="staffTelegramChatId"
          name="staffTelegramChatId"
          placeholder="e.g. 123456789 or -1001234567890 for a group"
          defaultValue={staffTelegramChatId ?? ""}
        />
        <p className="text-xs text-muted-foreground">
          Message your bot directly (or add it to a staff group), then find the chat ID via
          @userinfobot or @getidsbot on Telegram and paste it here. New booking requests and
          low-stock alerts are sent there.
        </p>
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && <p className="text-sm text-primary">Saved.</p>}
      <Button type="submit" disabled={pending} className="w-fit">
        Save Changes
      </Button>
    </form>
  );
}

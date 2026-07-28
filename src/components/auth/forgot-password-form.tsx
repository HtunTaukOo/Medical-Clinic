"use client";

import { useActionState } from "react";
import { requestPasswordReset, type RequestResetState } from "@/actions/auth";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState<RequestResetState, FormData>(
    requestPasswordReset,
    {}
  );

  if (state.success) {
    return (
      <p className="text-sm text-muted-foreground">
        If an account with that email exists and has Telegram connected, a reset link
        has been sent there. If you don&apos;t have Telegram connected, please contact
        the clinic front desk to reset your password.
      </p>
    );
  }

  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        Send reset link
      </Button>
      <p className="text-sm text-muted-foreground">
        <Link href="/login" className="underline">
          Back to login
        </Link>
      </p>
    </form>
  );
}

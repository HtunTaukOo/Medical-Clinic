"use client";

import { useActionState, useEffect, useRef } from "react";
import { changeOwnPassword, type ChangePasswordState } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState<ChangePasswordState, FormData>(
    changeOwnPassword,
    {}
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="grid gap-4">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Change Password
      </p>
      <div className="grid gap-1.5">
        <Label htmlFor="currentPassword">Current Password</Label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          required
          placeholder="Enter current password"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="newPassword">New Password</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          required
          minLength={8}
          placeholder="Min. 8 characters"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="confirmPassword">Confirm New Password</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          placeholder="Re-enter new password"
        />
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && <p className="text-sm text-blue-600">Password updated.</p>}
      <Button type="submit" disabled={pending} className="w-fit">
        Update Password
      </Button>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import {
  adminUpdateStaffAccount,
  type AdminUpdateStaffAccountState,
} from "@/actions/staff";
import { STAFF_TITLES } from "@/lib/staff-titles";
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

export function StaffAccountForm({
  userId,
  currentName,
  currentEmail,
  currentPhone,
  currentTitle,
  showTitle,
}: {
  userId: string;
  currentName: string;
  currentEmail: string;
  currentPhone?: string | null;
  currentTitle?: string | null;
  showTitle: boolean;
}) {
  const boundAction = adminUpdateStaffAccount.bind(null, userId);
  const [state, formAction, pending] = useActionState<AdminUpdateStaffAccountState, FormData>(
    boundAction,
    {}
  );

  return (
    <form action={formAction} className="grid gap-3">
      <div className="grid gap-1">
        <Label htmlFor={`name-${userId}`} className="text-xs">
          Name
        </Label>
        <Input id={`name-${userId}`} name="name" defaultValue={currentName} required />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1">
          <Label htmlFor={`email-${userId}`} className="text-xs">
            Email
          </Label>
          <Input
            id={`email-${userId}`}
            name="email"
            type="email"
            defaultValue={currentEmail}
            required
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor={`phone-${userId}`} className="text-xs">
            Phone
          </Label>
          <Input id={`phone-${userId}`} name="phone" defaultValue={currentPhone ?? ""} />
        </div>
      </div>

      {showTitle && (
        <div className="grid gap-1">
          <Label htmlFor={`title-${userId}`} className="text-xs">
            Job Title
          </Label>
          <Select name="title" defaultValue={currentTitle ?? undefined}>
            <SelectTrigger id={`title-${userId}`} className="w-full">
              <SelectValue placeholder="Set job title..." />
            </SelectTrigger>
            <SelectContent>
              {STAFF_TITLES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && <p className="text-sm text-primary">Saved.</p>}

      <Button type="submit" disabled={pending} className="w-fit justify-self-end">
        Save Changes
      </Button>
    </form>
  );
}

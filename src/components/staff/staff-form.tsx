"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { createStaff, type StaffFormState } from "@/actions/staff";
import { STAFF_TITLES } from "@/lib/staff-titles";
import { useRouter } from "@/i18n/navigation";
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

const ROLES = ["ADMIN", "DOCTOR", "STAFF"] as const;

export function StaffForm({
  lockRole,
  redirectTo = "/staff/users",
  specialties,
}: {
  lockRole?: (typeof ROLES)[number];
  redirectTo?: string;
  specialties: { name: string }[];
}) {
  const t = useTranslations("staff");
  const router = useRouter();
  const [role, setRole] = useState<string>(lockRole ?? "STAFF");
  const [state, formAction, pending] = useActionState<
    StaffFormState,
    FormData
  >(createStaff, {});

  useEffect(() => {
    if (state.success) router.push(redirectTo);
  }, [state.success, router, redirectTo]);

  return (
    <form action={formAction} className="grid max-w-md gap-4">
      <div className="grid gap-2">
        <Label htmlFor="name">{t("name")}</Label>
        <Input id="name" name="name" required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="email">{t("email")}</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" required minLength={8} />
      </div>
      {lockRole ? (
        <input type="hidden" name="role" value={lockRole} />
      ) : (
        <div className="grid gap-2">
          <Label htmlFor="role">{t("role")}</Label>
          <Select name="role" value={role} onValueChange={setRole}>
            <SelectTrigger id="role" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {role === "STAFF" && (
        <div className="grid gap-2">
          <Label htmlFor="title">Job Title</Label>
          <Select name="title" defaultValue={STAFF_TITLES[0]}>
            <SelectTrigger id="title" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STAFF_TITLES.map((title) => (
                <SelectItem key={title} value={title}>
                  {title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {role === "DOCTOR" && (
        <>
          <div className="grid gap-2">
            <Label htmlFor="specialty">Specialty</Label>
            <Select name="specialty">
              <SelectTrigger id="specialty" className="w-full">
                <SelectValue placeholder="Select specialty" />
              </SelectTrigger>
              <SelectContent>
                {specialties.map((s) => (
                  <SelectItem key={s.name} value={s.name}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="consultationFee">Consultation fee</Label>
            <Input
              id="consultationFee"
              name="consultationFee"
              type="number"
              min={0}
              step="0.01"
              placeholder="0.00"
            />
          </div>
        </>
      )}
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending} className="w-fit">
        {lockRole === "DOCTOR" ? "Add Doctor" : t("new")}
      </Button>
    </form>
  );
}

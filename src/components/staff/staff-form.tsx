"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { createStaff, type StaffFormState } from "@/actions/staff";
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

const ROLES = ["ADMIN", "DOCTOR", "RECEPTIONIST", "PHARMACIST"] as const;

export function StaffForm() {
  const t = useTranslations("staff");
  const router = useRouter();
  const [role, setRole] = useState<string>("RECEPTIONIST");
  const [state, formAction, pending] = useActionState<
    StaffFormState,
    FormData
  >(createStaff, {});

  useEffect(() => {
    if (state.success) router.push("/staff/users");
  }, [state.success, router]);

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
      {role === "DOCTOR" && (
        <div className="grid gap-2">
          <Label htmlFor="specialty">Specialty</Label>
          <Input id="specialty" name="specialty" />
        </div>
      )}
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending} className="w-fit">
        {t("new")}
      </Button>
    </form>
  );
}

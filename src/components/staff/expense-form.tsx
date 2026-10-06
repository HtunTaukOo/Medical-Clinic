"use client";

import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { createExpense, updateExpense, type ExpenseFormState } from "@/actions/expenses";
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS } from "@/lib/expenses";
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

export function ExpenseForm({
  expense,
  defaultPaidAt,
  onSaved,
  redirectOnSuccess = "/staff/expenses",
  allowedCategories,
}: {
  expense?: {
    id: string;
    category: string;
    description: string;
    amount: number;
    vendor: string | null;
    paidAt: string;
    recurringExpenseId?: string | null;
  };
  // Clinic-local "today" (YYYY-MM-DD), computed server-side — the client's
  // own clock isn't trustworthy enough to default a financial record's date.
  defaultPaidAt?: string;
  onSaved?: () => void;
  redirectOnSuccess?: string;
  // Restricts the category dropdown — staff only get the day-to-day
  // operational categories (also enforced server-side in createExpense),
  // admin gets every category (the default, when this is omitted).
  allowedCategories?: readonly string[];
}) {
  const t = useTranslations("expenses");
  const router = useRouter();
  const action = expense ? updateExpense.bind(null, expense.id) : createExpense;
  const [state, formAction, pending] = useActionState<ExpenseFormState, FormData>(action, {});
  const categoryOptions = allowedCategories ?? EXPENSE_CATEGORIES;

  useEffect(() => {
    if (state.success) {
      if (onSaved) onSaved();
      else router.push(redirectOnSuccess);
    }
  }, [state.success, onSaved, redirectOnSuccess, router]);

  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="description">{t("description")}</Label>
        <Input
          id="description"
          name="description"
          defaultValue={expense?.description}
          placeholder="e.g. September office rent"
          required
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="category">{t("category")}</Label>
          <Select name="category" defaultValue={expense?.category ?? "OTHER"}>
            <SelectTrigger id="category" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categoryOptions.map((c) => (
                <SelectItem key={c} value={c}>
                  {EXPENSE_CATEGORY_LABELS[c as keyof typeof EXPENSE_CATEGORY_LABELS]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="vendor">{t("vendorOptional")}</Label>
          <Input id="vendor" name="vendor" defaultValue={expense?.vendor ?? ""} placeholder="e.g. Landlord" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="amount">{t("amount")}</Label>
          <Input
            id="amount"
            name="amount"
            type="number"
            min={0.01}
            step="0.01"
            defaultValue={expense?.amount}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="paidAt">{t("date")}</Label>
          <Input
            id="paidAt"
            name="paidAt"
            type="date"
            defaultValue={expense?.paidAt ?? defaultPaidAt}
            required
          />
        </div>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 hover:bg-muted/50">
        <input
          name="repeatsMonthly"
          type="checkbox"
          defaultChecked={!!expense?.recurringExpenseId}
          className="mt-0.5 size-4 accent-primary"
        />
        <span className="grid gap-0.5">
          <span className="text-sm font-medium">{t("repeatMonthly")}</span>
          <span className="text-xs text-muted-foreground">
            {t("repeatMonthlyHelp")}
          </span>
        </span>
      </label>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending} className="w-fit">
        {expense ? t("saveChanges") : t("addExpense")}
      </Button>
    </form>
  );
}

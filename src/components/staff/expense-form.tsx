"use client";

import { useActionState, useEffect } from "react";
import { createExpense, updateExpense, type ExpenseFormState } from "@/actions/expenses";
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

const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  RENT: "Rent",
  UTILITIES: "Utilities",
  SALARIES: "Salaries",
  SUPPLIES: "Supplies",
  EQUIPMENT: "Equipment",
  MAINTENANCE: "Maintenance",
  MARKETING: "Marketing",
  INSURANCE: "Insurance",
  OTHER: "Other",
};

const EXPENSE_CATEGORIES = Object.keys(EXPENSE_CATEGORY_LABELS);

export function ExpenseForm({
  expense,
  defaultPaidAt,
  onSaved,
}: {
  expense?: {
    id: string;
    category: string;
    description: string;
    amount: number;
    vendor: string | null;
    paidAt: string;
  };
  // Clinic-local "today" (YYYY-MM-DD), computed server-side — the client's
  // own clock isn't trustworthy enough to default a financial record's date.
  defaultPaidAt?: string;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const action = expense ? updateExpense.bind(null, expense.id) : createExpense;
  const [state, formAction, pending] = useActionState<ExpenseFormState, FormData>(action, {});

  useEffect(() => {
    if (state.success) {
      if (onSaved) onSaved();
      else router.push("/staff/expenses");
    }
  }, [state.success, onSaved, router]);

  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="description">Description</Label>
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
          <Label htmlFor="category">Category</Label>
          <Select name="category" defaultValue={expense?.category ?? "OTHER"}>
            <SelectTrigger id="category" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EXPENSE_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {EXPENSE_CATEGORY_LABELS[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="vendor">Vendor (optional)</Label>
          <Input id="vendor" name="vendor" defaultValue={expense?.vendor ?? ""} placeholder="e.g. Landlord" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="amount">Amount (K)</Label>
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
          <Label htmlFor="paidAt">Date</Label>
          <Input
            id="paidAt"
            name="paidAt"
            type="date"
            defaultValue={expense?.paidAt ?? defaultPaidAt}
            required
          />
        </div>
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending} className="w-fit">
        {expense ? "Save Changes" : "Add Expense"}
      </Button>
    </form>
  );
}

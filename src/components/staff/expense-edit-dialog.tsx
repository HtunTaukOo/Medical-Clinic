"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ExpenseForm } from "@/components/staff/expense-form";

export function ExpenseEditDialog({
  expense,
}: {
  expense: {
    id: string;
    category: string;
    description: string;
    amount: number;
    vendor: string | null;
    paidAt: string;
    recurringExpenseId: string | null;
  };
}) {
  const t = useTranslations("expenses");
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className="font-medium text-primary underline underline-offset-2">
          Edit
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("editExpense")}</DialogTitle>
        </DialogHeader>
        <ExpenseForm expense={expense} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

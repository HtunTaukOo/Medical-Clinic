"use client";

import { useState } from "react";
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
  };
}) {
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
          <DialogTitle>Edit Expense</DialogTitle>
        </DialogHeader>
        <ExpenseForm expense={expense} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

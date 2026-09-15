"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { parseDateOnlyInput } from "@/lib/doctor-availability";
import { EXPENSE_CATEGORIES, STAFF_EXPENSE_CATEGORIES } from "@/lib/expenses";

function revalidateExpenseConsumers() {
  revalidatePath("/staff/expenses");
  revalidatePath("/staff/reports");
}

const expenseSchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES),
  description: z.string().min(1),
  amount: z.coerce.number().positive(),
  vendor: z.string().optional(),
  paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type ExpenseFormState = { error?: string; success?: boolean };

// Staff can record day-to-day costs (supplies, small purchases) as they
// happen, but only admins can see the full expense list (it includes
// Salaries/Rent) or edit/delete an entry — see updateExpense/deleteExpense
// below, both still admin-only.
export async function createExpense(
  _prevState: ExpenseFormState,
  formData: FormData
): Promise<ExpenseFormState> {
  const session = await requireRole(["ADMIN", "STAFF"]);

  const parsed = expenseSchema.safeParse({
    category: formData.get("category"),
    description: formData.get("description"),
    amount: formData.get("amount"),
    vendor: formData.get("vendor") || undefined,
    paidAt: formData.get("paidAt"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  if (
    session.user.role === "STAFF" &&
    !(STAFF_EXPENSE_CATEGORIES as readonly string[]).includes(parsed.data.category)
  ) {
    return { error: "Staff can only record Supplies, Equipment, Maintenance, or Other expenses." };
  }

  await prisma.expense.create({
    data: {
      category: parsed.data.category,
      description: parsed.data.description,
      amount: parsed.data.amount,
      vendor: parsed.data.vendor || null,
      paidAt: parseDateOnlyInput(parsed.data.paidAt),
      recordedById: session.user.id,
    },
  });

  revalidateExpenseConsumers();
  return { success: true };
}

export async function updateExpense(
  expenseId: string,
  _prevState: ExpenseFormState,
  formData: FormData
): Promise<ExpenseFormState> {
  await requireRole(["ADMIN"]);

  const parsed = expenseSchema.safeParse({
    category: formData.get("category"),
    description: formData.get("description"),
    amount: formData.get("amount"),
    vendor: formData.get("vendor") || undefined,
    paidAt: formData.get("paidAt"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await prisma.expense.update({
    where: { id: expenseId },
    data: {
      category: parsed.data.category,
      description: parsed.data.description,
      amount: parsed.data.amount,
      vendor: parsed.data.vendor || null,
      paidAt: parseDateOnlyInput(parsed.data.paidAt),
    },
  });

  revalidateExpenseConsumers();
  return { success: true };
}

export async function deleteExpense(expenseId: string) {
  await requireRole(["ADMIN"]);
  await prisma.expense.delete({ where: { id: expenseId } });
  revalidateExpenseConsumers();
}

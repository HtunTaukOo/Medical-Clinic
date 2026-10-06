"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { parseDateOnlyInput } from "@/lib/doctor-availability";
import { clinicDateParts } from "@/lib/clinic-hours";
import { EXPENSE_CATEGORIES, STAFF_EXPENSE_CATEGORIES } from "@/lib/expenses";
import { nextMonthlyDueDate } from "@/lib/recurring-expenses";

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

  const paidAt = parseDateOnlyInput(parsed.data.paidAt);
  const dayOfMonth = clinicDateParts(paidAt).day;
  const repeatsMonthly = formData.get("repeatsMonthly") === "on";

  await prisma.$transaction(async (tx) => {
    const recurringExpense = repeatsMonthly
      ? await tx.recurringExpense.create({
          data: {
            category: parsed.data.category,
            description: parsed.data.description,
            amount: parsed.data.amount,
            vendor: parsed.data.vendor || null,
            dayOfMonth,
            nextDueAt: nextMonthlyDueDate(paidAt, dayOfMonth),
            recordedById: session.user.id,
          },
        })
      : null;

    await tx.expense.create({
      data: {
        category: parsed.data.category,
        description: parsed.data.description,
        amount: parsed.data.amount,
        vendor: parsed.data.vendor || null,
        paidAt,
        recordedById: session.user.id,
        recurringExpenseId: recurringExpense?.id,
      },
    });
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

  const existing = await prisma.expense.findUniqueOrThrow({ where: { id: expenseId } });
  const paidAt = parseDateOnlyInput(parsed.data.paidAt);
  const dayOfMonth = clinicDateParts(paidAt).day;
  const repeatsMonthly = formData.get("repeatsMonthly") === "on";

  await prisma.$transaction(async (tx) => {
    let recurringExpenseId = existing.recurringExpenseId;

    if (repeatsMonthly) {
      if (recurringExpenseId) {
        await tx.recurringExpense.update({
          where: { id: recurringExpenseId },
          data: {
            category: parsed.data.category,
            description: parsed.data.description,
            amount: parsed.data.amount,
            vendor: parsed.data.vendor || null,
            dayOfMonth,
            nextDueAt: nextMonthlyDueDate(paidAt, dayOfMonth),
            active: true,
          },
        });
      } else {
        const schedule = await tx.recurringExpense.create({
          data: {
            category: parsed.data.category,
            description: parsed.data.description,
            amount: parsed.data.amount,
            vendor: parsed.data.vendor || null,
            dayOfMonth,
            nextDueAt: nextMonthlyDueDate(paidAt, dayOfMonth),
            recordedById: existing.recordedById,
          },
        });
        recurringExpenseId = schedule.id;
      }
    } else if (recurringExpenseId) {
      await tx.recurringExpense.update({
        where: { id: recurringExpenseId },
        data: { active: false },
      });
      recurringExpenseId = null;
    }

    await tx.expense.update({
      where: { id: expenseId },
      data: {
        category: parsed.data.category,
        description: parsed.data.description,
        amount: parsed.data.amount,
        vendor: parsed.data.vendor || null,
        paidAt,
        recurringExpenseId,
      },
    });
  });

  revalidateExpenseConsumers();
  return { success: true };
}

export async function deleteExpense(expenseId: string) {
  await requireRole(["ADMIN"]);
  await prisma.expense.delete({ where: { id: expenseId } });
  revalidateExpenseConsumers();
}

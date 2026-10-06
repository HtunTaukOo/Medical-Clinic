import { prisma } from "@/lib/prisma";
import { clinicDateParts, clinicMidnight, clinicMidnightForYMD } from "@/lib/clinic-hours";

function dueDateForMonth(year: number, month: number, dayOfMonth: number) {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return clinicMidnightForYMD(year, month, Math.min(dayOfMonth, lastDay));
}

export function nextMonthlyDueDate(date: Date, dayOfMonth: number) {
  const { year, month } = clinicDateParts(date);
  const nextMonth = month === 12 ? 1 : month + 1;
  return dueDateForMonth(month === 12 ? year + 1 : year, nextMonth, dayOfMonth);
}

// Creates every missing monthly occurrence through the current clinic day.
// The compound unique key on Expense makes this safe if the cron endpoint is
// retried or two workers happen to process the same schedule.
export async function createDueRecurringExpenses(now: Date = new Date()) {
  const today = clinicMidnight(now);
  const schedules = await prisma.recurringExpense.findMany({
    where: { active: true, nextDueAt: { lte: today } },
  });

  let created = 0;
  for (const schedule of schedules) {
    await prisma.$transaction(async (tx) => {
      let dueAt = schedule.nextDueAt;
      let nextDueAt = dueAt;

      while (dueAt <= today) {
        const existing = await tx.expense.findUnique({
          where: {
            recurringExpenseId_paidAt: {
              recurringExpenseId: schedule.id,
              paidAt: dueAt,
            },
          },
        });
        if (!existing) {
          await tx.expense.create({
            data: {
              category: schedule.category,
              description: schedule.description,
              amount: schedule.amount,
              vendor: schedule.vendor,
              paidAt: dueAt,
              recordedById: schedule.recordedById,
              recurringExpenseId: schedule.id,
            },
          });
          created++;
        }
        nextDueAt = nextMonthlyDueDate(dueAt, schedule.dayOfMonth);
        dueAt = nextDueAt;
      }

      await tx.recurringExpense.update({
        where: { id: schedule.id },
        data: { nextDueAt },
      });
    });
  }

  return created;
}

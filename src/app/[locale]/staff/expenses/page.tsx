import { Receipt, Plus, HandCoins } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ExpenseCategory, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/authz";
import { clinicDateKey } from "@/lib/clinic-hours";
import { resolveReportRange, formatRangeLabel } from "@/lib/reports";
import { deleteExpense } from "@/actions/expenses";
import { EXPENSE_CATEGORIES, STAFF_EXPENSE_CATEGORIES } from "@/lib/expenses";
import { ExpenseEditDialog } from "@/components/staff/expense-edit-dialog";
import { ExpenseCategoryFilter } from "@/components/staff/expense-category-filter";
import { DateRangeFilter } from "@/components/reports/date-range-filter";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";

function formatKyat(value: number) {
  return `MMK ${Math.round(value).toLocaleString()}`;
}

const CATEGORY_COLORS: Record<string, string> = {
  RENT: "bg-blue-100 text-blue-700",
  UTILITIES: "bg-cyan-100 text-cyan-700",
  SALARIES: "bg-violet-100 text-violet-700",
  SUPPLIES: "bg-amber-100 text-amber-700",
  EQUIPMENT: "bg-orange-100 text-orange-700",
  MAINTENANCE: "bg-slate-100 text-slate-700",
  MARKETING: "bg-pink-100 text-pink-700",
  INSURANCE: "bg-emerald-100 text-emerald-700",
  OTHER: "bg-gray-100 text-gray-600",
};

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; category?: string }>;
}) {
  const session = await requirePageRole(["ADMIN", "STAFF"]);
  const t = await getTranslations("expenses");
  const categoryLabels: Record<ExpenseCategory, string> = {
    RENT: t("categoryRent"),
    UTILITIES: t("categoryUtilities"),
    SALARIES: t("categorySalaries"),
    SUPPLIES: t("categorySupplies"),
    EQUIPMENT: t("categoryEquipment"),
    MAINTENANCE: t("categoryMaintenance"),
    MARKETING: t("categoryMarketing"),
    INSURANCE: t("categoryInsurance"),
    OTHER: t("categoryOther"),
  };
  const isStaff = session.user.role === "STAFF";
  const allowedCategories: readonly string[] = isStaff ? STAFF_EXPENSE_CATEGORIES : EXPENSE_CATEGORIES;

  const { from, to, category: categoryParam } = await searchParams;
  const range = resolveReportRange(from, to);
  const category: ExpenseCategory | null =
    categoryParam && allowedCategories.includes(categoryParam)
      ? (categoryParam as ExpenseCategory)
      : null;

  // Staff get a shared log of what any staff member has recorded (always in
  // the staff-allowed categories, enforced at creation) — never an admin's
  // own entries, and never Rent/Salaries/etc, regardless of category filter.
  const where: Prisma.ExpenseWhereInput = {
    paidAt: { gte: range.start, lt: range.endExclusive },
    ...(category ? { category } : {}),
    ...(isStaff ? { recordedBy: { role: "STAFF" } } : {}),
  };

  // The "Total Expenses" banner only makes sense for admin — staff's list is
  // already a filtered subset (their categories, staff-recorded only), so a
  // dollar total there would look like the clinic's real spend but wouldn't
  // be it. Skip computing it for staff rather than show a misleading figure.
  const [expenses, rangeTotal] = await Promise.all([
    prisma.expense.findMany({
      where,
      orderBy: { paidAt: "desc" },
      include: { recordedBy: true },
    }),
    isStaff ? Promise.resolve(null) : prisma.expense.aggregate({ _sum: { amount: true }, where }),
  ]);

  const totalInRange = rangeTotal ? Number(rangeTotal._sum.amount ?? 0) : 0;

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("trackCosts")}</p>
        </div>
        <Button asChild>
          <Link href="/staff/expenses/new">
            <Plus className="size-4" />
            {t("addExpense")}
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <DateRangeFilter
          defaultFrom={range.from}
          defaultTo={range.to}
          todayKey={clinicDateKey(new Date())}
        />
        <ExpenseCategoryFilter
          defaultCategory={category ?? "all"}
          categories={isStaff ? STAFF_EXPENSE_CATEGORIES : undefined}
        />
      </div>

      {!isStaff && (
        <div className="flex items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-rose-500 to-rose-600 p-6 text-white">
          <div>
            <p className="text-xs font-semibold tracking-wide text-rose-50 uppercase">
              {t("totalExpenses", { range: formatRangeLabel(range) })}
            </p>
            <p className="mt-1 text-3xl font-bold">{formatKyat(totalInRange)}</p>
            <p className="mt-1 text-sm text-rose-50">
              {t("expensesRecorded", { count: expenses.length })}
            </p>
          </div>
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white">
            <HandCoins className="size-5" />
          </div>
        </div>
      )}

      {expenses.length === 0 ? (
        <EmptyState icon={Receipt} message={t("noMatchingExpenses")} />
      ) : (
        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("date")}</TableHead>
                  <TableHead>{t("category")}</TableHead>
                  <TableHead>{t("description")}</TableHead>
                  <TableHead>{t("vendor")}</TableHead>
                  <TableHead>{t("amount")}</TableHead>
                  <TableHead>{t("recordedBy")}</TableHead>
                  {!isStaff && <TableHead className="text-right">{t("actions")}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell className="text-muted-foreground">
                      {expense.paidAt.toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={CATEGORY_COLORS[expense.category]}>
                        {categoryLabels[expense.category]}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{expense.description}</TableCell>
                    <TableCell className="text-muted-foreground">{expense.vendor ?? "—"}</TableCell>
                    <TableCell>{formatKyat(Number(expense.amount))}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {expense.recordedBy.name}
                    </TableCell>
                    {!isStaff && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-3">
                          <ExpenseEditDialog
                            expense={{
                              id: expense.id,
                              category: expense.category,
                              description: expense.description,
                              amount: Number(expense.amount),
                              vendor: expense.vendor,
                              paidAt: expense.paidAt.toISOString().slice(0, 10),
                              recurringExpenseId: expense.recurringExpenseId,
                            }}
                          />
                          <form action={deleteExpense.bind(null, expense.id)}>
                            <button
                              type="submit"
                              className="font-medium text-destructive hover:underline"
                            >
                              {t("delete")}
                            </button>
                          </form>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

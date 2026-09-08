import { Receipt, Plus, HandCoins } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/authz";
import { clinicMidnightForYMD, clinicDateParts } from "@/lib/clinic-hours";
import { deleteExpense } from "@/actions/expenses";
import { ExpenseEditDialog } from "@/components/staff/expense-edit-dialog";
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
  return `K ${Math.round(value).toLocaleString()}`;
}

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

export default async function ExpensesPage() {
  await requirePageRole(["ADMIN"]);

  const now = new Date();
  const { year, month } = clinicDateParts(now);
  const monthStart = clinicMidnightForYMD(year, month, 1);
  const nextMonthStart = clinicMidnightForYMD(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1, 1);

  const [expenses, monthTotal] = await Promise.all([
    prisma.expense.findMany({
      orderBy: { paidAt: "desc" },
      include: { recordedBy: true },
    }),
    prisma.expense.aggregate({
      _sum: { amount: true },
      where: { paidAt: { gte: monthStart, lt: nextMonthStart } },
    }),
  ]);

  const totalThisMonth = Number(monthTotal._sum.amount ?? 0);
  const countThisMonth = expenses.filter(
    (e) => e.paidAt >= monthStart && e.paidAt < nextMonthStart
  ).length;

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Expenses</h1>
          <p className="text-sm text-muted-foreground">Track clinic operating costs.</p>
        </div>
        <Button asChild>
          <Link href="/staff/expenses/new">
            <Plus className="size-4" />
            Add Expense
          </Link>
        </Button>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-rose-500 to-rose-600 p-6 text-white">
        <div>
          <p className="text-xs font-semibold tracking-wide text-rose-50 uppercase">
            Total Expenses (This Month)
          </p>
          <p className="mt-1 text-3xl font-bold">{formatKyat(totalThisMonth)}</p>
          <p className="mt-1 text-sm text-rose-50">
            {countThisMonth} expense{countThisMonth === 1 ? "" : "s"} recorded
          </p>
        </div>
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white">
          <HandCoins className="size-5" />
        </div>
      </div>

      {expenses.length === 0 ? (
        <EmptyState icon={Receipt} message="No expenses recorded yet." />
      ) : (
        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Recorded By</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
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
                        {EXPENSE_CATEGORY_LABELS[expense.category]}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{expense.description}</TableCell>
                    <TableCell className="text-muted-foreground">{expense.vendor ?? "—"}</TableCell>
                    <TableCell>{formatKyat(Number(expense.amount))}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {expense.recordedBy.name}
                    </TableCell>
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
                          }}
                        />
                        <form action={deleteExpense.bind(null, expense.id)}>
                          <button
                            type="submit"
                            className="font-medium text-destructive hover:underline"
                          >
                            Delete
                          </button>
                        </form>
                      </div>
                    </TableCell>
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

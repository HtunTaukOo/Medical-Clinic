import { requirePageRole } from "@/lib/authz";
import { clinicDateKey } from "@/lib/clinic-hours";
import { STAFF_EXPENSE_CATEGORIES } from "@/lib/expenses";
import { BackLink } from "@/components/back-link";
import { ExpenseForm } from "@/components/staff/expense-form";

export default async function NewExpensePage() {
  const session = await requirePageRole(["ADMIN", "STAFF"]);

  return (
    <div className="grid gap-4">
      <BackLink href="/staff/expenses" />
      <h1 className="text-2xl font-semibold">Add Expense</h1>
      <ExpenseForm
        defaultPaidAt={clinicDateKey(new Date())}
        allowedCategories={session.user.role === "STAFF" ? STAFF_EXPENSE_CATEGORIES : undefined}
      />
    </div>
  );
}

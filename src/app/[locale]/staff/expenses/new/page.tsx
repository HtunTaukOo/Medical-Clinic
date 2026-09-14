import { requirePageRole } from "@/lib/authz";
import { clinicDateKey } from "@/lib/clinic-hours";
import { BackLink } from "@/components/back-link";
import { ExpenseForm } from "@/components/staff/expense-form";

export default async function NewExpensePage() {
  await requirePageRole(["ADMIN"]);

  return (
    <div className="grid gap-4">
      <BackLink href="/staff/expenses" />
      <h1 className="text-2xl font-semibold">Add Expense</h1>
      <ExpenseForm defaultPaidAt={clinicDateKey(new Date())} />
    </div>
  );
}

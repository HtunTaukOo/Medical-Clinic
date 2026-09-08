import { ChevronLeft } from "lucide-react";
import { requirePageRole } from "@/lib/authz";
import { clinicDateKey } from "@/lib/clinic-hours";
import { Link } from "@/i18n/navigation";
import { ExpenseForm } from "@/components/staff/expense-form";

export default async function NewExpensePage() {
  await requirePageRole(["ADMIN"]);

  return (
    <div className="grid gap-4">
      <Link
        href="/staff/expenses"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Back
      </Link>
      <h1 className="text-2xl font-semibold">Add Expense</h1>
      <ExpenseForm defaultPaidAt={clinicDateKey(new Date())} />
    </div>
  );
}

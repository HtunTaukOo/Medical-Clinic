import { ArrowDownCircle, ArrowUpCircle, ChevronLeft, History } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/authz";
import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { SearchInput } from "@/components/search-input";
import { InventoryFilterSelect } from "@/components/inventory/inventory-filter-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function StockMovementPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string }>;
}) {
  await requirePageRole(["ADMIN", "STAFF"]);
  const { q, type } = await searchParams;

  const transactions = await prisma.stockTransaction.findMany({
    where: {
      type: type === "IN" || type === "OUT" ? type : undefined,
      medicine: q ? { name: { contains: q, mode: "insensitive" as const } } : undefined,
    },
    include: { medicine: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="grid gap-6">
      <Link
        href="/staff/inventory"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Back
      </Link>

      <h1 className="text-2xl font-semibold">Stock Movement</h1>

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput placeholder="Search medicine..." />
        <InventoryFilterSelect
          paramName="type"
          placeholder="All Types"
          options={[
            { value: "IN", label: "Stock In" },
            { value: "OUT", label: "Stock Out" },
          ]}
        />
      </div>

      <Card>
        <CardContent>
          {transactions.length === 0 ? (
            <EmptyState icon={History} message="No stock movements recorded yet." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Medicine</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((txn) => (
                  <TableRow key={txn.id}>
                    <TableCell className="text-muted-foreground">
                      {new Date(txn.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/staff/inventory/${txn.medicineId}`}
                        className="font-medium underline underline-offset-2"
                      >
                        {txn.medicine.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`flex items-center gap-1 ${
                          txn.type === "IN" ? "text-emerald-700" : "text-rose-700"
                        }`}
                      >
                        {txn.type === "IN" ? (
                          <ArrowUpCircle className="size-4" />
                        ) : (
                          <ArrowDownCircle className="size-4" />
                        )}
                        {txn.type}
                      </span>
                    </TableCell>
                    <TableCell>
                      {txn.quantity} {txn.medicine.unit}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{txn.reason ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

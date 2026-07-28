import { notFound } from "next/navigation";
import { ArrowDownCircle, ArrowUpCircle, History } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function MedicineHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["ADMIN", "PHARMACIST"]);
  const { id } = await params;
  const t = await getTranslations("inventory");

  const medicine = await prisma.medicine.findUnique({
    where: { id },
    include: {
      stockTransactions: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!medicine) notFound();

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{medicine.name}</h1>
          <p className="text-muted-foreground">
            {medicine.stockQty} {medicine.unit} in stock &mdash;{" "}
            {Number(medicine.price).toFixed(2)} per {medicine.unit}
          </p>
        </div>
        {medicine.stockQty <= medicine.reorderLevel && (
          <Badge variant="destructive">{t("lowStock")}</Badge>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Stock history</CardTitle>
        </CardHeader>
        <CardContent>
          {medicine.stockTransactions.length === 0 ? (
            <EmptyState icon={History} message="No stock movements recorded yet." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {medicine.stockTransactions.map((txn) => (
                  <TableRow key={txn.id}>
                    <TableCell>{new Date(txn.createdAt).toLocaleString()}</TableCell>
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
                    <TableCell>{txn.quantity}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {txn.reason ?? "—"}
                    </TableCell>
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

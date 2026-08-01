import { notFound } from "next/navigation";
import { ArrowDownCircle, ArrowUpCircle, History } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { getExpiryStatus } from "@/lib/inventory";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { ExpiryForm } from "@/components/inventory/expiry-form";
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

  const expiryStatus = getExpiryStatus(medicine.expiryDate);

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
        <div className="flex flex-col items-end gap-1">
          {medicine.stockQty <= medicine.reorderLevel && (
            <Badge variant="destructive">{t("lowStock")}</Badge>
          )}
          {expiryStatus === "expired" && (
            <Badge variant="destructive">{t("expired")}</Badge>
          )}
          {expiryStatus === "expiring" && (
            <Badge className="bg-amber-500 text-white">{t("expiringSoon")}</Badge>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("expiryDate")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          <p className="text-sm text-muted-foreground">
            {medicine.expiryDate
              ? new Date(medicine.expiryDate).toLocaleDateString()
              : t("noExpirySet")}
          </p>
          <ExpiryForm
            medicineId={medicine.id}
            currentExpiryDate={
              medicine.expiryDate ? medicine.expiryDate.toISOString().slice(0, 10) : null
            }
          />
        </CardContent>
      </Card>

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

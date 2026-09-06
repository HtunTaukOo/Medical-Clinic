import { Pill, AlertTriangle, Clock } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/authz";
import { deleteMedicine } from "@/actions/inventory";
import { getExpiryStatus } from "@/lib/inventory";
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
import { SearchInput } from "@/components/search-input";
import { InventoryFilterSelect } from "@/components/inventory/inventory-filter-select";

type StockStatus = "OUT_OF_STOCK" | "LOW_STOCK" | "IN_STOCK";

function getStockStatus(stockQty: number, reorderLevel: number): StockStatus {
  if (stockQty === 0) return "OUT_OF_STOCK";
  if (stockQty <= reorderLevel) return "LOW_STOCK";
  return "IN_STOCK";
}

const STOCK_STATUS_LABEL: Record<StockStatus, string> = {
  OUT_OF_STOCK: "Out of stock",
  LOW_STOCK: "Low stock",
  IN_STOCK: "In stock",
};

const STOCK_STATUS_CLASS: Record<StockStatus, string> = {
  OUT_OF_STOCK: "bg-rose-100 text-rose-700",
  LOW_STOCK: "bg-amber-100 text-amber-700",
  IN_STOCK: "bg-emerald-100 text-emerald-700",
};

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; status?: string }>;
}) {
  await requirePageRole(["ADMIN", "STAFF"]);
  const t = await getTranslations("inventory");
  const { q, category, status } = await searchParams;

  const allMedicines = await prisma.medicine.findMany({ orderBy: { name: "asc" } });

  const totalItems = allMedicines.length;
  const inStockCount = allMedicines.filter(
    (m) => getStockStatus(m.stockQty, m.reorderLevel) === "IN_STOCK"
  ).length;
  const lowStockList = allMedicines.filter(
    (m) => getStockStatus(m.stockQty, m.reorderLevel) === "LOW_STOCK"
  );
  const outOfStockCount = allMedicines.filter(
    (m) => getStockStatus(m.stockQty, m.reorderLevel) === "OUT_OF_STOCK"
  ).length;
  const expiringList = allMedicines.filter((m) => getExpiryStatus(m.expiryDate) === "expiring");
  const expiredList = allMedicines.filter((m) => getExpiryStatus(m.expiryDate) === "expired");

  const categories = [...new Set(allMedicines.map((m) => m.category).filter(Boolean))] as string[];

  let medicines = allMedicines;
  if (q) {
    medicines = medicines.filter((m) => m.name.toLowerCase().includes(q.toLowerCase()));
  }
  if (category) {
    medicines = medicines.filter((m) => m.category === category);
  }
  if (status) {
    medicines = medicines.filter((m) => {
      if (status === "EXPIRING") return getExpiryStatus(m.expiryDate) === "expiring";
      if (status === "EXPIRED") return getExpiryStatus(m.expiryDate) === "expired";
      return getStockStatus(m.stockQty, m.reorderLevel) === status;
    });
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Inventory Management</h1>
          <p className="text-sm text-muted-foreground">
            Track stock levels, expiry dates, and medicine orders.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/staff/inventory/stock-movement">Stock Movement</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/staff/inventory/purchase-orders">{t("purchaseOrders")}</Link>
          </Button>
          <Button asChild>
            <Link href="/staff/inventory/new">{t("newMedicine")}</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Card className="border-border">
          <CardContent className="text-center">
            <p className="text-2xl font-bold">{totalItems}</p>
            <p className="text-sm text-muted-foreground">Total Items</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="text-center">
            <p className="text-2xl font-bold text-emerald-700">{inStockCount}</p>
            <p className="text-sm text-emerald-700">In Stock</p>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="text-center">
            <p className="text-2xl font-bold text-amber-700">{lowStockList.length}</p>
            <p className="text-sm text-amber-700">Low Stock</p>
          </CardContent>
        </Card>
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="text-center">
            <p className="text-2xl font-bold text-orange-700">{expiringList.length}</p>
            <p className="text-sm text-orange-700">Expiring Soon</p>
          </CardContent>
        </Card>
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="text-center">
            <p className="text-2xl font-bold text-rose-700">{expiredList.length}</p>
            <p className="text-sm text-rose-700">Expired</p>
          </CardContent>
        </Card>
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="text-center">
            <p className="text-2xl font-bold text-rose-700">{outOfStockCount}</p>
            <p className="text-sm text-rose-700">Out of Stock</p>
          </CardContent>
        </Card>
      </div>

      {expiredList.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-rose-600" />
          <div>
            <p className="font-semibold text-rose-700">Expired Items — Immediate Action Required</p>
            <p className="text-sm text-rose-700">
              {expiredList
                .map((m) => `${m.name} — remove from dispensing shelves immediately`)
                .join(" · ")}
            </p>
          </div>
        </div>
      )}

      {expiringList.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-orange-200 bg-orange-50 p-4">
          <Clock className="mt-0.5 size-5 shrink-0 text-orange-600" />
          <div>
            <p className="font-semibold text-orange-700">Expiring Soon</p>
            <p className="text-sm text-orange-700">
              {expiringList
                .map(
                  (m) =>
                    `${m.name} (expires ${m.expiryDate?.toLocaleDateString(undefined, {
                      month: "short",
                      year: "numeric",
                    })})`
                )
                .join(" · ")}
            </p>
          </div>
        </div>
      )}

      {lowStockList.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-semibold text-amber-700">Low Stock Warning</p>
            <p className="text-sm text-amber-700">
              {lowStockList
                .map(
                  (m) =>
                    `${m.name} — ${m.stockQty} ${m.unit} remaining (reorder at ${m.reorderLevel})`
                )
                .join(" · ")}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput placeholder="Search medicine..." />
        <InventoryFilterSelect
          paramName="category"
          placeholder="All Categories"
          options={categories.map((c) => ({ value: c, label: c }))}
        />
        <InventoryFilterSelect
          paramName="status"
          placeholder="All Statuses"
          options={[
            { value: "IN_STOCK", label: "In stock" },
            { value: "LOW_STOCK", label: "Low stock" },
            { value: "OUT_OF_STOCK", label: "Out of stock" },
            { value: "EXPIRING", label: "Expiring soon" },
            { value: "EXPIRED", label: "Expired" },
          ]}
        />
      </div>

      <Card>
        <CardContent>
          {medicines.length === 0 ? (
            <EmptyState icon={Pill} message={t("noResults")} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("name")}</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>{t("price")}</TableHead>
                  <TableHead>{t("stockQty")}</TableHead>
                  <TableHead>{t("expiryDate")}</TableHead>
                  <TableHead>{t("reorderLevel")}</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {medicines.map((medicine) => {
                  const stockStatus = getStockStatus(medicine.stockQty, medicine.reorderLevel);
                  const expiryStatus = getExpiryStatus(medicine.expiryDate);
                  return (
                    <TableRow key={medicine.id}>
                      <TableCell className="font-medium">{medicine.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {medicine.category ?? "—"}
                      </TableCell>
                      <TableCell>{Number(medicine.price).toFixed(2)}</TableCell>
                      <TableCell>
                        {medicine.stockQty} {medicine.unit}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {medicine.expiryDate
                          ? new Date(medicine.expiryDate).toLocaleDateString(undefined, {
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {medicine.reorderLevel}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-1">
                          <Badge variant="outline" className={STOCK_STATUS_CLASS[stockStatus]}>
                            {STOCK_STATUS_LABEL[stockStatus]}
                          </Badge>
                          {expiryStatus === "expired" && (
                            <Badge variant="outline" className="bg-rose-100 text-rose-700">
                              {t("expired")}
                            </Badge>
                          )}
                          {expiryStatus === "expiring" && (
                            <Badge variant="outline" className="bg-orange-100 text-orange-700">
                              {t("expiringSoon")}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-3">
                          <Link
                            href={`/staff/inventory/${medicine.id}/edit`}
                            className="font-medium text-primary underline"
                          >
                            Edit
                          </Link>
                          <Link
                            href={`/staff/inventory/${medicine.id}`}
                            className="font-medium text-primary underline"
                          >
                            Restock
                          </Link>
                          <form action={deleteMedicine.bind(null, medicine.id)}>
                            <button
                              type="submit"
                              className="font-medium text-destructive underline"
                            >
                              Delete
                            </button>
                          </form>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

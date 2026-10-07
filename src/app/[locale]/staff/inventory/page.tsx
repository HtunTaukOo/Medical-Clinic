import { Pill } from "lucide-react";
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
import { BackLink } from "@/components/back-link";

type StockStatus = "OUT_OF_STOCK" | "LOW_STOCK" | "IN_STOCK";

function getStockStatus(stockQty: number, reorderLevel: number): StockStatus {
  if (stockQty === 0) return "OUT_OF_STOCK";
  if (stockQty <= reorderLevel) return "LOW_STOCK";
  return "IN_STOCK";
}

const STOCK_STATUS_KEY: Record<StockStatus, "outOfStock" | "lowStock" | "inStock"> = {
  OUT_OF_STOCK: "outOfStock",
  LOW_STOCK: "lowStock",
  IN_STOCK: "inStock",
};

const STOCK_STATUS_CLASS: Record<StockStatus, string> = {
  OUT_OF_STOCK: "bg-rose-100 text-rose-700",
  LOW_STOCK: "bg-amber-100 text-amber-700",
  IN_STOCK: "bg-emerald-100 text-emerald-700",
};

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; status?: string; from?: string }>;
}) {
  await requirePageRole(["ADMIN", "STAFF"]);
  const t = await getTranslations("inventory");
  const { q, category, status, from } = await searchParams;

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
      {from === "dashboard" && <BackLink href="/staff" />}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("managementTitle")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("managementDescription")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/staff/inventory/stock-movement">{t("stockMovement")}</Link>
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
            <p className="text-sm text-muted-foreground">{t("totalItems")}</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="text-center">
            <p className="text-2xl font-bold text-emerald-700">{inStockCount}</p>
            <p className="text-sm text-emerald-700">{t("inStock")}</p>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="text-center">
            <p className="text-2xl font-bold text-amber-700">{lowStockList.length}</p>
            <p className="text-sm text-amber-700">{t("lowStock")}</p>
          </CardContent>
        </Card>
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="text-center">
            <p className="text-2xl font-bold text-orange-700">{expiringList.length}</p>
            <p className="text-sm text-orange-700">{t("expiringSoon")}</p>
          </CardContent>
        </Card>
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="text-center">
            <p className="text-2xl font-bold text-rose-700">{expiredList.length}</p>
            <p className="text-sm text-rose-700">{t("expired")}</p>
          </CardContent>
        </Card>
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="text-center">
            <p className="text-2xl font-bold text-rose-700">{outOfStockCount}</p>
            <p className="text-sm text-rose-700">{t("outOfStock")}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput placeholder={t("searchMedicine")} />
        <InventoryFilterSelect
          paramName="category"
          placeholder={t("allCategories")}
          options={categories.map((c) => ({ value: c, label: c }))}
        />
        <InventoryFilterSelect
          paramName="status"
          placeholder={t("allStatuses")}
          options={[
            { value: "IN_STOCK", label: t("inStock") },
            { value: "LOW_STOCK", label: t("lowStock") },
            { value: "OUT_OF_STOCK", label: t("outOfStock") },
            { value: "EXPIRING", label: t("expiringSoon") },
            { value: "EXPIRED", label: t("expired") },
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
                  <TableHead>{t("generic")}</TableHead>
                  <TableHead>{t("price")}</TableHead>
                  <TableHead>{t("stockQty")}</TableHead>
                  <TableHead>{t("expiryDate")}</TableHead>
                  <TableHead>{t("reorderLevel")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead className="text-right">{t("actions")}</TableHead>
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
                        {medicine.brand ?? "—"}
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
                            {t(STOCK_STATUS_KEY[stockStatus])}
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
                            {t("edit")}
                          </Link>
                          <Link
                            href={`/staff/inventory/${medicine.id}`}
                            className="font-medium text-primary underline"
                          >
                            {t("restock")}
                          </Link>
                          <form action={deleteMedicine.bind(null, medicine.id)}>
                            <button
                              type="submit"
                              className="font-medium text-destructive underline"
                            >
                              {t("delete")}
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

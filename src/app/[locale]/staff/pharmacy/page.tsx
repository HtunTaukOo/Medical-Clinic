import { ClipboardList, Pill, Receipt, Undo2, Bell } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/authz";
import { getExpiryStatus, getStockStatus, STOCK_STATUS_LABEL, STOCK_STATUS_CLASS } from "@/lib/inventory";
import { rxCode } from "@/lib/pharmacy";
import { processReturn } from "@/actions/pharmacy";
import { cancelMedicineRequest } from "@/actions/medicine-requests";
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
import { NewSaleForm } from "@/components/pharmacy/new-sale-form";
import { TabTransitionScope, TabButton, TabTransitionContent } from "@/components/tab-transition";

function formatKyat(value: number) {
  return `MMK ${Math.round(value).toLocaleString()}`;
}

const STATUS_LABEL: Record<string, string> = {
  ...STOCK_STATUS_LABEL,
  EXPIRING: "expiring soon",
  EXPIRED: "expired",
};

const STATUS_CLASS: Record<string, string> = {
  ...STOCK_STATUS_CLASS,
  EXPIRING: "bg-orange-100 text-orange-700",
  EXPIRED: "bg-rose-100 text-rose-700",
};

const TABS = [
  { value: "new", labelKey: "newSale" },
  { value: "prescriptions", labelKey: "prescriptions" },
  { value: "requests", labelKey: "patientRequests" },
  { value: "products", labelKey: "products" },
  { value: "history", labelKey: "salesHistory" },
  { value: "returns", labelKey: "returns" },
] as const;
type Tab = (typeof TABS)[number]["value"];

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export default async function PharmacyPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    rx?: string;
    patientId?: string;
    medicineId?: string;
    requestId?: string;
  }>;
}) {
  await requirePageRole(["ADMIN", "STAFF"]);
  const t = await getTranslations("pharmacySale");
  const { tab: tabParam, rx, patientId, medicineId, requestId } = await searchParams;
  const tab: Tab = TABS.some(({ value }) => value === tabParam) ? (tabParam as Tab) : "new";

  const needsPending = tab === "new" || tab === "prescriptions";
  const { start: todayStart, end: todayEnd } = todayRange();

  const [pendingPrescriptions, allMedicines, patients, sales, returns, pendingRequests] =
    await Promise.all([
      needsPending
        ? prisma.prescription.findMany({
            where: { fulfilled: false },
            include: { patient: true, items: { include: { medicine: true } } },
            orderBy: { createdAt: "asc" },
          })
        : Promise.resolve([]),
      tab === "new" || tab === "products"
        ? prisma.medicine.findMany({ orderBy: { name: "asc" } })
        : Promise.resolve([]),
      tab === "new" ? prisma.patient.findMany({ orderBy: { name: "asc" } }) : Promise.resolve([]),
      tab === "history"
        ? prisma.pharmacySale.findMany({
            orderBy: { createdAt: "desc" },
            include: { patient: true, items: true },
            take: 200,
          })
        : Promise.resolve([]),
      tab === "returns"
        ? prisma.pharmacySale.findMany({
            where: { status: "RETURNED", returnedAt: { gte: todayStart, lt: todayEnd } },
            orderBy: { returnedAt: "desc" },
            include: { patient: true, items: true },
          })
        : Promise.resolve([]),
      tab === "requests"
        ? prisma.medicineRequest.findMany({
            where: { status: "PENDING" },
            include: {
              patient: true,
              medicine: true,
              prescription: { include: { items: { include: { medicine: true } } } },
            },
            orderBy: { createdAt: "asc" },
          })
        : Promise.resolve([]),
    ]);

  return (
    <TabTransitionScope>
      <div className="grid gap-6">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("description")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {TABS.map(({ value, labelKey }) => (
            <TabButton key={value} href={`/staff/pharmacy?tab=${value}`} active={tab === value} size="sm">
              {t(labelKey)}
            </TabButton>
          ))}
        </div>

        <TabTransitionContent className="grid gap-6">
      {tab === "new" && (
        <NewSaleForm
          pendingPrescriptions={pendingPrescriptions.map((rxItem) => ({
            id: rxItem.id,
            createdAt: rxItem.createdAt.toISOString(),
            patient: {
              id: rxItem.patient.id,
              name: rxItem.patient.name,
              dob: rxItem.patient.dob ? rxItem.patient.dob.toISOString() : null,
              phone: rxItem.patient.phone,
            },
            items: rxItem.items.map((item) => ({
              id: item.id,
              dosage: item.dosage,
              quantity: item.quantity,
              medicine: {
                id: item.medicine.id,
                name: item.medicine.name,
                price: Number(item.medicine.price),
                unit: item.medicine.unit,
              },
            })),
          }))}
          medicines={allMedicines.map((m) => ({
            id: m.id,
            name: m.name,
            price: Number(m.price),
            unit: m.unit,
            stockQty: m.stockQty,
          }))}
          patients={patients.map((p) => ({ id: p.id, name: p.name }))}
          initialRxCode={rx}
          initialPatientId={patientId}
          initialMedicineId={medicineId}
          initialRequestId={requestId}
        />
      )}

      {tab === "prescriptions" &&
        (pendingPrescriptions.length === 0 ? (
          <EmptyState icon={ClipboardList} message={t("noPendingPrescriptions")} />
        ) : (
          <div className="grid gap-3">
            {pendingPrescriptions.map((rxItem) => (
              <Card key={rxItem.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{rxItem.patient.name}</span>
                      <Badge variant="outline" className="font-mono text-xs text-primary">
                        {rxCode(rxItem.id, rxItem.createdAt)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {rxItem.items.map((i) => i.medicine.name).join(", ")}
                    </p>
                  </div>
                  <Button asChild size="sm">
                    <Link href={`/staff/pharmacy?tab=new&rx=${rxCode(rxItem.id, rxItem.createdAt)}`}>
                      {t("dispense")}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ))}

      {tab === "requests" &&
        (pendingRequests.length === 0 ? (
          <EmptyState icon={Bell} message={t("noPatientRequests")} />
        ) : (
          <div className="grid gap-3">
            {pendingRequests.map((req) => {
              const isRefill = !!req.prescription;
              const sellHref = isRefill
                ? `/staff/pharmacy?tab=new&rx=${rxCode(req.prescription!.id, req.prescription!.createdAt)}&requestId=${req.id}`
                : `/staff/pharmacy?tab=new&patientId=${req.patientId}&medicineId=${req.medicineId}&requestId=${req.id}`;
              return (
                <Card key={req.id}>
                  <CardContent className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{req.patient.name}</span>
                        <Badge variant="outline" className="bg-cyan-100 text-cyan-700">
                          {isRefill ? t("refillRequest") : t("notifyPharmacy")}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {isRefill
                          ? req.prescription!.items.map((i) => i.medicine.name).join(", ")
                          : `${req.medicine?.name ?? t("unknownMedicine")}${req.quantity ? ` · ${t("quantity", { count: req.quantity })}` : ""}`}
                      </p>
                      {req.note && <p className="text-sm text-muted-foreground">“{req.note}”</p>}
                      <p className="text-xs text-muted-foreground">
                        {t("requested", {
                          date: req.createdAt.toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          }),
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button asChild size="sm">
                        <Link href={sellHref}>{isRefill ? t("dispense") : t("sell")}</Link>
                      </Button>
                      <form action={cancelMedicineRequest.bind(null, req.id)}>
                        <button
                          type="submit"
                          className="text-sm font-medium text-destructive hover:underline"
                        >
                          {t("dismiss")}
                        </button>
                      </form>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ))}

      {tab === "products" && (
        <Card>
          <CardContent>
            <div className="mb-3 flex items-center justify-between">
              <p className="font-semibold">{t("productCatalogue")}</p>
              <p className="text-sm text-muted-foreground">{t("itemsCount", { count: allMedicines.length })}</p>
            </div>
            {allMedicines.length === 0 ? (
              <EmptyState icon={Pill} message={t("noMedicines")} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("name")}</TableHead>
                    <TableHead>{t("category")}</TableHead>
                    <TableHead>{t("stock")}</TableHead>
                    <TableHead>{t("sellingPrice")}</TableHead>
                    <TableHead>{t("expiry")}</TableHead>
                    <TableHead>{t("status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allMedicines.map((m) => {
                    const expiryStatus = getExpiryStatus(m.expiryDate);
                    const status = expiryStatus
                      ? expiryStatus.toUpperCase()
                      : getStockStatus(m.stockQty, m.reorderLevel);
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">{m.name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {m.category ?? "—"}
                        </TableCell>
                        <TableCell>
                          {m.stockQty} {m.unit}
                        </TableCell>
                        <TableCell>{formatKyat(Number(m.price))}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {m.expiryDate
                            ? new Date(m.expiryDate).toLocaleDateString(undefined, {
                                month: "short",
                                year: "numeric",
                              })
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={STATUS_CLASS[status]}>
                            {STATUS_LABEL[status]}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "history" &&
        (sales.length === 0 ? (
          <EmptyState icon={Receipt} message={t("noSales")} />
        ) : (
          <Card>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("date")}</TableHead>
                    <TableHead>{t("patient")}</TableHead>
                    <TableHead>{t("rxNumber")}</TableHead>
                    <TableHead>{t("items")}</TableHead>
                    <TableHead>{t("total")}</TableHead>
                    <TableHead>{t("method")}</TableHead>
                    <TableHead className="text-right">{t("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {sale.createdAt.toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="font-medium">{sale.patient.name}</TableCell>
                      <TableCell>
                        {sale.prescriptionId ? (
                          <span className="font-mono text-xs text-primary">
                            {rxCode(sale.prescriptionId, sale.createdAt)}
                          </span>
                        ) : (
                          <Badge variant="outline">OTC</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {sale.items.map((i) => `${i.name} x${i.quantity}`).join(", ")}
                      </TableCell>
                      <TableCell>{formatKyat(Number(sale.total))}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {sale.paymentMethod}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-3">
                          <Link
                            href={`/pharmacy-receipt/${sale.id}`}
                            className="font-medium text-primary underline underline-offset-2"
                          >
                            {t("receipt")}
                          </Link>
                          {sale.status === "COMPLETED" ? (
                            <form action={processReturn.bind(null, sale.id)}>
                              <button
                                type="submit"
                                className="font-medium text-destructive underline underline-offset-2"
                              >
                              {t("return")}
                              </button>
                            </form>
                          ) : (
                            <Badge variant="outline" className="bg-rose-100 text-rose-700">
                              {t("returned")}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}

      {tab === "returns" &&
        (returns.length === 0 ? (
          <EmptyState icon={Undo2} message={t("noReturns")} />
        ) : (
          <Card>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("time")}</TableHead>
                    <TableHead>{t("patient")}</TableHead>
                    <TableHead>{t("items")}</TableHead>
                    <TableHead>{t("amount")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {returns.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell className="text-muted-foreground">
                        {sale.returnedAt?.toLocaleTimeString(undefined, {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell className="font-medium">{sale.patient.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {sale.items.map((i) => `${i.name} x${i.quantity}`).join(", ")}
                      </TableCell>
                      <TableCell>{formatKyat(Number(sale.total))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
        </TabTransitionContent>
      </div>
    </TabTransitionScope>
  );
}

import { ClipboardList, Pill, Receipt, Undo2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/authz";
import { getExpiryStatus } from "@/lib/inventory";
import { rxCode } from "@/lib/pharmacy";
import { processReturn } from "@/actions/pharmacy";
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

function formatKyat(value: number) {
  return `K ${Math.round(value).toLocaleString()}`;
}

type StockStatus = "OUT_OF_STOCK" | "LOW_STOCK" | "IN_STOCK";

function getStockStatus(stockQty: number, reorderLevel: number): StockStatus {
  if (stockQty === 0) return "OUT_OF_STOCK";
  if (stockQty <= reorderLevel) return "LOW_STOCK";
  return "IN_STOCK";
}

const STATUS_LABEL: Record<string, string> = {
  OUT_OF_STOCK: "out of stock",
  LOW_STOCK: "low stock",
  IN_STOCK: "in stock",
  EXPIRING: "expiring soon",
  EXPIRED: "expired",
};

const STATUS_CLASS: Record<string, string> = {
  OUT_OF_STOCK: "bg-rose-100 text-rose-700",
  LOW_STOCK: "bg-amber-100 text-amber-700",
  IN_STOCK: "bg-emerald-100 text-emerald-700",
  EXPIRING: "bg-orange-100 text-orange-700",
  EXPIRED: "bg-rose-100 text-rose-700",
};

const TABS = [
  { value: "new", label: "New Sale" },
  { value: "prescriptions", label: "Prescriptions" },
  { value: "products", label: "Products" },
  { value: "history", label: "Sales History" },
  { value: "returns", label: "Returns" },
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
  searchParams: Promise<{ tab?: string; rx?: string }>;
}) {
  await requirePageRole(["ADMIN", "STAFF"]);
  const { tab: tabParam, rx } = await searchParams;
  const tab: Tab = TABS.some(({ value }) => value === tabParam) ? (tabParam as Tab) : "new";

  const needsPending = tab === "new" || tab === "prescriptions";
  const { start: todayStart, end: todayEnd } = todayRange();

  const [pendingPrescriptions, allMedicines, patients, sales, returns] = await Promise.all([
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
  ]);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Pharmacy</h1>
        <p className="text-sm text-muted-foreground">
          Dispense prescriptions and sell over-the-counter medicine.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map(({ value, label }) => (
          <Button key={value} asChild variant={tab === value ? "default" : "outline"} size="sm">
            <Link href={`/staff/pharmacy?tab=${value}`}>{label}</Link>
          </Button>
        ))}
      </div>

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
        />
      )}

      {tab === "prescriptions" &&
        (pendingPrescriptions.length === 0 ? (
          <EmptyState icon={ClipboardList} message="Prescription queue — no pending prescriptions." />
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
                      Sell
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ))}

      {tab === "products" && (
        <Card>
          <CardContent>
            <div className="mb-3 flex items-center justify-between">
              <p className="font-semibold">Product Catalogue</p>
              <p className="text-sm text-muted-foreground">{allMedicines.length} items</p>
            </div>
            {allMedicines.length === 0 ? (
              <EmptyState icon={Pill} message="No medicines in catalogue." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Selling Price</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead>Status</TableHead>
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
          <EmptyState icon={Receipt} message="No sales recorded yet." />
        ) : (
          <Card>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Rx #</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
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
                            Receipt
                          </Link>
                          {sale.status === "COMPLETED" ? (
                            <form action={processReturn.bind(null, sale.id)}>
                              <button
                                type="submit"
                                className="font-medium text-destructive underline underline-offset-2"
                              >
                                Return
                              </button>
                            </form>
                          ) : (
                            <Badge variant="outline" className="bg-rose-100 text-rose-700">
                              Returned
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
          <EmptyState icon={Undo2} message="No returns processed today." />
        ) : (
          <Card>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Amount</TableHead>
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
    </div>
  );
}

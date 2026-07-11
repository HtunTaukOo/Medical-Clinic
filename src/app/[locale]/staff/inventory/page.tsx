import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { fulfillPrescription } from "@/actions/prescriptions";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdjustStockForm } from "@/components/inventory/adjust-stock-form";

export default async function InventoryPage() {
  await requireRole(["ADMIN", "PHARMACIST"]);
  const t = await getTranslations("inventory");

  const [medicines, pendingPrescriptions] = await Promise.all([
    prisma.medicine.findMany({ orderBy: { name: "asc" } }),
    prisma.prescription.findMany({
      where: { fulfilled: false },
      include: {
        patient: true,
        items: { include: { medicine: true } },
        appointment: { include: { invoice: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <Button asChild>
          <Link href="/staff/inventory/new">{t("newMedicine")}</Link>
        </Button>
      </div>

      {pendingPrescriptions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending prescriptions</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {pendingPrescriptions.map((rx) => {
              const isPaid = rx.appointment.invoice?.status === "PAID";
              return (
                <div key={rx.id} className="rounded-md border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <Link
                      href={`/staff/patients/${rx.patientId}`}
                      className="font-medium underline"
                    >
                      {rx.patient.name}
                    </Link>
                    {isPaid ? (
                      <form action={fulfillPrescription.bind(null, rx.id)}>
                        <Button size="sm" type="submit">
                          {t("fulfill")}
                        </Button>
                      </form>
                    ) : (
                      <Badge variant="destructive">{t("paymentRequired")}</Badge>
                    )}
                  </div>
                  <ul className="text-sm text-muted-foreground">
                    {rx.items.map((item) => (
                      <li key={item.id}>
                        {item.medicine.name} &mdash; {item.dosage} x{item.quantity}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("name")}</TableHead>
            <TableHead>{t("unit")}</TableHead>
            <TableHead>{t("stockQty")}</TableHead>
            <TableHead>{t("price")}</TableHead>
            <TableHead>{t("adjustStock")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {medicines.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground">
                {t("noResults")}
              </TableCell>
            </TableRow>
          )}
          {medicines.map((medicine) => (
            <TableRow key={medicine.id}>
              <TableCell>{medicine.name}</TableCell>
              <TableCell>{medicine.unit}</TableCell>
              <TableCell>
                {medicine.stockQty}
                {medicine.stockQty <= medicine.reorderLevel && (
                  <Badge variant="destructive" className="ml-2">
                    {t("lowStock")}
                  </Badge>
                )}
              </TableCell>
              <TableCell>{Number(medicine.price).toFixed(2)}</TableCell>
              <TableCell>
                <AdjustStockForm medicineId={medicine.id} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

import { Pill, ClipboardList } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { fulfillPrescription } from "@/actions/prescriptions";
import { getExpiryStatus } from "@/lib/inventory";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
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

      <Card>
        <CardHeader>
          <CardTitle>Pending prescriptions</CardTitle>
        </CardHeader>
        <CardContent>
          {pendingPrescriptions.length === 0 ? (
            <EmptyState icon={ClipboardList} message="No pending prescriptions." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {pendingPrescriptions.map((rx) => {
                const isPaid = rx.appointment.invoice?.status === "PAID";
                return (
                  <Card key={rx.id} className="border-muted-foreground/20">
                    <CardContent className="grid gap-3">
                      <div className="flex items-center justify-between gap-2">
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
                            {item.timesPerDay && item.durationDays && (
                              <> (reminders: {item.timesPerDay}x/day for {item.durationDays} days)</>
                            )}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {medicines.length === 0 ? (
        <EmptyState icon={Pill} message={t("noResults")} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {medicines.map((medicine) => (
            <Card key={medicine.id}>
              <CardContent className="grid gap-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="flex size-11 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                      <Pill className="size-5" />
                    </div>
                    <div>
                      <p className="font-semibold">{medicine.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {medicine.stockQty} {medicine.unit} &mdash; {Number(medicine.price).toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {medicine.stockQty <= medicine.reorderLevel && (
                      <Badge variant="destructive">{t("lowStock")}</Badge>
                    )}
                    {getExpiryStatus(medicine.expiryDate) === "expired" && (
                      <Badge variant="destructive">{t("expired")}</Badge>
                    )}
                    {getExpiryStatus(medicine.expiryDate) === "expiring" && (
                      <Badge className="bg-amber-500 text-white">{t("expiringSoon")}</Badge>
                    )}
                  </div>
                </div>
                <AdjustStockForm medicineId={medicine.id} />
                <Link
                  href={`/staff/inventory/${medicine.id}`}
                  className="text-sm text-muted-foreground underline underline-offset-2"
                >
                  View stock history
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

import { Pill, ClipboardList } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getStockStatus, STOCK_STATUS_LABEL, STOCK_STATUS_CLASS } from "@/lib/inventory";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/empty-state";
import { RequestRefillButton, NotifyPharmacyButton } from "@/components/portal/medicine-request-form";

const PILL_TAB_LIST = "!h-auto w-full flex-wrap justify-start gap-2 bg-transparent p-0";
const PILL_TAB_TRIGGER =
  "!h-auto flex-none grow-0 rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-foreground shadow-none data-active:border-transparent data-active:bg-primary data-active:text-primary-foreground";

function formatKyat(value: number) {
  return `K ${Math.round(value).toLocaleString()}`;
}

export default async function PortalMedicinesPage() {
  const session = await auth();
  const t = await getTranslations();
  const tp = await getTranslations("portal.medicines");
  const patientId = session?.user.patientId;

  const [medicines, prescriptions, myRequests] = await Promise.all([
    prisma.medicine.findMany({ orderBy: { name: "asc" } }),
    patientId
      ? prisma.prescription.findMany({
          where: { patientId },
          orderBy: { createdAt: "desc" },
          include: {
            doctor: { include: { user: true } },
            items: { include: { medicine: true } },
          },
        })
      : [],
    patientId
      ? prisma.medicineRequest.findMany({
          where: { patientId, status: "PENDING" },
          select: { medicineId: true, prescriptionId: true },
        })
      : [],
  ]);

  const pendingMedicineIds = new Set(myRequests.map((r) => r.medicineId).filter(Boolean));
  const pendingPrescriptionIds = new Set(myRequests.map((r) => r.prescriptionId).filter(Boolean));

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{t("nav.medicines")}</h1>
        <p className="text-sm text-muted-foreground">{tp("description")}</p>
      </div>

      <Tabs defaultValue="catalog">
        <TabsList className={PILL_TAB_LIST}>
          <TabsTrigger value="catalog" className={PILL_TAB_TRIGGER}>
            {tp("tabAvailable")}
          </TabsTrigger>
          <TabsTrigger value="prescriptions" className={PILL_TAB_TRIGGER}>
            {tp("tabPrescriptions")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="mt-4">
          {medicines.length === 0 ? (
            <EmptyState icon={Pill} message={tp("noMedicines")} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {medicines.map((m) => {
                const status = getStockStatus(m.stockQty, m.reorderLevel);
                return (
                  <Card key={m.id}>
                    <CardContent className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{m.name}</p>
                        {m.brand && <p className="text-xs text-muted-foreground">{m.brand}</p>}
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">
                            {formatKyat(Number(m.price))}
                          </span>
                          <Badge variant="outline" className={STOCK_STATUS_CLASS[status]}>
                            {STOCK_STATUS_LABEL[status]}
                          </Badge>
                        </div>
                      </div>
                      {patientId && status !== "OUT_OF_STOCK" && (
                        <NotifyPharmacyButton
                          medicineId={m.id}
                          alreadyPending={pendingMedicineIds.has(m.id)}
                        />
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="prescriptions" className="mt-4">
          {prescriptions.length === 0 ? (
            <EmptyState icon={ClipboardList} message={tp("noPrescriptions")} />
          ) : (
            <div className="grid gap-3">
              {prescriptions.map((rx) => (
                <Card key={rx.id}>
                  <CardContent className="grid gap-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">{rx.doctor.user.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {rx.createdAt.toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          rx.fulfilled
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
                        }
                      >
                        {rx.fulfilled ? tp("fulfilled") : tp("pendingStatus")}
                      </Badge>
                    </div>
                    <ul className="grid gap-1 text-sm text-muted-foreground">
                      {rx.items.map((item) => (
                        <li key={item.id}>
                          {item.medicine.name} · {item.dosage}
                        </li>
                      ))}
                    </ul>
                    {!rx.fulfilled && (
                      <div className="flex justify-end">
                        <RequestRefillButton
                          prescriptionId={rx.id}
                          alreadyPending={pendingPrescriptionIds.has(rx.id)}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

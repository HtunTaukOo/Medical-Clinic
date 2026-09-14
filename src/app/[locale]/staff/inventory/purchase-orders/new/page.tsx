import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/authz";
import { BackLink } from "@/components/back-link";
import { PurchaseOrderForm } from "@/components/inventory/purchase-order-form";

export default async function NewPurchaseOrderPage() {
  await requirePageRole(["ADMIN", "STAFF"]);
  const t = await getTranslations("inventory");

  const [suppliers, medicines] = await Promise.all([
    prisma.supplier.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.medicine.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="grid gap-4">
      <BackLink href="/staff/inventory/purchase-orders" />
      <h1 className="text-2xl font-semibold">{t("newPurchaseOrder")}</h1>
      <PurchaseOrderForm
        suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
        medicines={medicines.map((m) => ({ id: m.id, name: m.name, price: Number(m.price) }))}
      />
    </div>
  );
}

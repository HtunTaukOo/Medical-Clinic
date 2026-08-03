import { Truck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/authz";
import { toggleSupplierActive } from "@/actions/suppliers";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { SupplierForm } from "@/components/inventory/supplier-form";

export default async function SuppliersPage() {
  await requirePageRole(["ADMIN", "PHARMACIST"]);
  const t = await getTranslations("inventory");

  const suppliers = await prisma.supplier.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">{t("suppliers")}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{t("newSupplier")}</CardTitle>
        </CardHeader>
        <CardContent>
          <SupplierForm />
        </CardContent>
      </Card>

      {suppliers.length === 0 ? (
        <EmptyState icon={Truck} message={t("noSuppliers")} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {suppliers.map((supplier) => (
            <Card key={supplier.id}>
              <CardContent className="grid gap-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{supplier.name}</p>
                  <Badge variant={supplier.active ? "default" : "outline"}>
                    {supplier.active ? t("active") : t("inactive")}
                  </Badge>
                </div>
                <div className="grid gap-1 text-sm text-muted-foreground">
                  {supplier.contactName && <p>{supplier.contactName}</p>}
                  {supplier.phone && <p>{supplier.phone}</p>}
                  {supplier.email && <p>{supplier.email}</p>}
                  {supplier.address && <p>{supplier.address}</p>}
                </div>
                <form action={toggleSupplierActive.bind(null, supplier.id)}>
                  <Button size="sm" variant="outline" type="submit">
                    {supplier.active ? t("deactivate") : t("activate")}
                  </Button>
                </form>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

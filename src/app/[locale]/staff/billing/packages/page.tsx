import { PackageIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { togglePackageActive } from "@/actions/packages";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { PackageForm } from "@/components/billing/package-form";

export default async function PackagesPage() {
  await requireRole(["ADMIN", "RECEPTIONIST"]);
  const t = await getTranslations("billing");

  const packages = await prisma.package.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">{t("packages")}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{t("newPackage")}</CardTitle>
        </CardHeader>
        <CardContent>
          <PackageForm />
        </CardContent>
      </Card>

      {packages.length === 0 ? (
        <EmptyState icon={PackageIcon} message={t("noPackages")} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {packages.map((pkg) => (
            <Card key={pkg.id}>
              <CardContent className="grid gap-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">{pkg.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {Number(pkg.price).toFixed(2)}
                    </p>
                  </div>
                  <Badge variant={pkg.active ? "default" : "outline"}>
                    {pkg.active ? t("active") : t("inactive")}
                  </Badge>
                </div>
                {pkg.description && (
                  <p className="text-sm text-muted-foreground">{pkg.description}</p>
                )}
                <form action={togglePackageActive.bind(null, pkg.id)}>
                  <Button size="sm" variant="outline" type="submit">
                    {pkg.active ? t("deactivate") : t("activate")}
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

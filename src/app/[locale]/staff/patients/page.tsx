import { Phone, Mail, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { EmptyState } from "@/components/empty-state";
import { SearchInput } from "@/components/search-input";
import { initials } from "@/lib/format";

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireRole(["ADMIN", "DOCTOR", "RECEPTIONIST"]);
  const t = await getTranslations("patients");
  const { q } = await searchParams;

  const patients = await prisma.patient.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <Button asChild>
          <Link href="/staff/patients/new">{t("new")}</Link>
        </Button>
      </div>

      <SearchInput placeholder="Search patients by name, phone, or email..." />

      {patients.length === 0 ? (
        <EmptyState
          icon={Users}
          message={q ? `No patients match "${q}".` : t("noResults")}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {patients.map((patient) => (
            <Link key={patient.id} href={`/staff/patients/${patient.id}`}>
              <Card className="h-full transition-colors hover:bg-muted/50">
                <CardContent className="grid gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="size-12">
                      <AvatarFallback className="bg-secondary text-secondary-foreground">
                        {initials(patient.name)}
                      </AvatarFallback>
                    </Avatar>
                    <p className="font-semibold">{patient.name}</p>
                  </div>
                  <div className="grid gap-1 text-sm text-muted-foreground">
                    {patient.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="size-4" />
                        {patient.phone}
                      </div>
                    )}
                    {patient.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="size-4" />
                        {patient.email}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

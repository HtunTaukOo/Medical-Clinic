import { Stethoscope } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { SearchInput } from "@/components/search-input";
import { initials } from "@/lib/format";

export default async function FindDoctorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const t = await getTranslations("appointments");
  const tNav = await getTranslations("nav");
  const { q } = await searchParams;
  const now = new Date();
  const soon = new Date(now.getTime() + 30 * 60 * 1000);

  const doctors = await prisma.doctorProfile.findMany({
    where: q
      ? {
          OR: [
            { user: { name: { contains: q, mode: "insensitive" } } },
            { specialty: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    include: {
      user: true,
      appointments: {
        where: {
          status: "CONFIRMED",
          scheduledAt: { gte: now, lte: soon },
        },
        take: 1,
      },
    },
    orderBy: { user: { name: "asc" } },
  });

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-semibold">{tNav("findDoctors")}</h1>
      <SearchInput placeholder="Search doctors by name or specialty..." />
      {doctors.length === 0 && (
        <EmptyState
          icon={Stethoscope}
          message={q ? `No doctors match "${q}".` : "No doctors available yet."}
        />
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {doctors.map((doctor) => {
          const isBusy = doctor.appointments.length > 0;
          return (
            <Card key={doctor.id}>
              <CardContent className="grid gap-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="size-12">
                      <AvatarFallback className="bg-secondary text-secondary-foreground">
                        {initials(doctor.user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{doctor.user.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {doctor.specialty ?? "General Practice"}
                      </p>
                    </div>
                  </div>
                  <Badge variant={isBusy ? "secondary" : "outline"}>
                    {isBusy ? "Busy" : "Available"}
                  </Badge>
                </div>
                <Button asChild className="w-fit">
                  <Link href={`/portal/appointments/new?doctorId=${doctor.id}`}>
                    {t("requestNew")}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

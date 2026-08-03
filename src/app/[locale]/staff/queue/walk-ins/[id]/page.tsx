import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/authz";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConvertWalkInForm } from "@/components/queue/convert-walk-in-form";

export default async function ConvertWalkInPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageRole(["ADMIN", "RECEPTIONIST"]);
  const { id } = await params;
  const t = await getTranslations("appointments");

  const [walkIn, patients, doctors] = await Promise.all([
    prisma.walkIn.findUnique({ where: { id } }),
    prisma.patient.findMany({ orderBy: { name: "asc" } }),
    prisma.doctorProfile.findMany({ include: { user: true } }),
  ]);

  if (!walkIn || walkIn.status !== "CALLED") notFound();

  return (
    <div className="grid gap-6">
      <div className="flex items-center gap-3">
        <Badge variant="secondary" className="text-base">
          #{walkIn.tokenNumber}
        </Badge>
        <h1 className="text-2xl font-semibold">{t("startVisit")}</h1>
      </div>

      {(walkIn.name || walkIn.phone || walkIn.reason) && (
        <Card>
          <CardHeader>
            <CardTitle>{t("walkInDetails")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-1 text-sm text-muted-foreground">
            {walkIn.name && <p>{walkIn.name}</p>}
            {walkIn.phone && <p>{walkIn.phone}</p>}
            {walkIn.reason && <p>{walkIn.reason}</p>}
          </CardContent>
        </Card>
      )}

      <ConvertWalkInForm
        walkInId={walkIn.id}
        patients={patients.map((p) => ({ id: p.id, name: p.name }))}
        doctors={doctors.map((d) => ({ id: d.id, name: d.user.name }))}
        defaultDoctorId={walkIn.doctorId ?? undefined}
      />
    </div>
  );
}

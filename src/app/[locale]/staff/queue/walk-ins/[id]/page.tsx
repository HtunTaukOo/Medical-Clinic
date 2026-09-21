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
  await requirePageRole(["ADMIN", "STAFF"]);
  const { id } = await params;
  const t = await getTranslations("appointments");

  const [walkIn, patients, doctors, bookByServiceSpecialties, blockCapacitySpecialties, labServices, labTests] =
    await Promise.all([
      prisma.walkIn.findUnique({ where: { id } }),
      prisma.patient.findMany({ orderBy: { name: "asc" } }),
      prisma.doctorProfile.findMany({ include: { user: true } }),
      prisma.specialty.findMany({ where: { bookingMode: "SERVICE_CAPACITY" }, select: { name: true } }),
      prisma.specialty.findMany({ where: { bookingMode: "BLOCK_CAPACITY" }, select: { name: true } }),
      prisma.clinicService.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
      prisma.labTest.findMany({ orderBy: { name: "asc" } }),
    ]);

  if (!walkIn || walkIn.status !== "CALLED") notFound();

  const serviceSpecialtyNames = new Set(bookByServiceSpecialties.map((s) => s.name));
  const walkInDoctor = walkIn.doctorId ? doctors.find((d) => d.id === walkIn.doctorId) : null;
  const defaultIsServiceDoctor =
    !!walkInDoctor?.specialty && serviceSpecialtyNames.has(walkInDoctor.specialty);
  const realDoctors = doctors.filter((d) => !d.specialty || !serviceSpecialtyNames.has(d.specialty));

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
        doctors={realDoctors.map((d) => ({ id: d.id, name: d.user.name, specialty: d.specialty }))}
        defaultDoctorId={defaultIsServiceDoctor ? undefined : (walkIn.doctorId ?? undefined)}
        defaultSpecialtyName={defaultIsServiceDoctor ? (walkInDoctor!.specialty ?? undefined) : undefined}
        bookByServiceSpecialties={bookByServiceSpecialties.map((s) => s.name)}
        blockCapacitySpecialties={blockCapacitySpecialties.map((s) => s.name)}
        clinicServices={labServices.map((s) => ({ id: s.id, name: s.name, specialty: s.specialty }))}
        labTests={labTests.map((t) => ({
          id: t.id,
          name: t.name,
          unit: t.unit,
          normalRange: t.normalRange,
          price: Number(t.price),
          category: t.category,
        }))}
      />
    </div>
  );
}

import { Phone, Mail, Users, AlertTriangle, ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/authz";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { EmptyState } from "@/components/empty-state";
import { SearchInput } from "@/components/search-input";
import { initials, calculateAge } from "@/lib/format";
import { AVATAR_COLORS, GENDER_LETTER } from "@/components/appointments/appointment-row";

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await requirePageRole(["ADMIN", "DOCTOR", "RECEPTIONIST"]);
  const t = await getTranslations("patients");
  const { q } = await searchParams;
  const doctorId = session.user.doctorId;
  const isDoctor = session.user.role === "DOCTOR";

  const searchFilter = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { phone: { contains: q, mode: "insensitive" as const } },
          { email: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};
  const scopeFilter =
    isDoctor && doctorId
      ? {
          OR: [
            { appointments: { some: { doctorId } } },
            { walkIns: { some: { doctorId } } },
          ],
        }
      : {};

  const patients = await prisma.patient.findMany({
    where: { AND: [searchFilter, scopeFilter] },
    orderBy: { createdAt: "desc" },
    include: {
      diagnoses: { where: { status: "ACTIVE" }, orderBy: { createdAt: "desc" }, take: 3 },
      allergyRecords: { select: { id: true } },
      appointments: doctorId
        ? { where: { doctorId }, orderBy: { scheduledAt: "desc" }, take: 1, select: { scheduledAt: true } }
        : { orderBy: { scheduledAt: "desc" }, take: 1, select: { scheduledAt: true } },
    },
  });

  if (isDoctor) {
    return (
      <div className="grid gap-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">My Patients</h1>
            <p className="text-sm text-muted-foreground">
              {patients.length} patient{patients.length === 1 ? "" : "s"} in your list.
            </p>
          </div>
          <SearchInput placeholder="Search patients or conditions..." />
        </div>

        {patients.length === 0 ? (
          <EmptyState icon={Users} message={q ? `No patients match "${q}".` : t("noResults")} />
        ) : (
          <div className="grid gap-2">
            {patients.map((patient, index) => {
              const age = calculateAge(patient.dob);
              const genderLetter = patient.gender ? GENDER_LETTER[patient.gender] : null;
              const allergyCount = patient.allergyRecords.length;
              const lastVisit = patient.appointments[0]?.scheduledAt ?? null;
              const metaParts = [
                age != null ? `${age}yo` : null,
                genderLetter,
                patient.bloodType,
              ].filter(Boolean);
              return (
                <Link
                  key={patient.id}
                  href={`/staff/patients/${patient.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border bg-card p-4 hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="size-11">
                      <AvatarFallback className={AVATAR_COLORS[index % AVATAR_COLORS.length]}>
                        {initials(patient.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">
                        {patient.name}
                        {metaParts.length > 0 && (
                          <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                            · {metaParts.join(" · ")}
                          </span>
                        )}
                      </p>
                      {patient.diagnoses.length > 0 ? (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {patient.diagnoses.map((d) => (
                            <Badge key={d.id} variant="outline" className="bg-amber-100 text-amber-700">
                              {d.description}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No active conditions</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="grid justify-items-end gap-1">
                      {allergyCount > 0 && (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="size-3" />
                          {allergyCount} {allergyCount === 1 ? "allergy" : "allergies"}
                        </Badge>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {lastVisit
                          ? `Last: ${lastVisit.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
                          : "No visits yet"}
                      </p>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

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

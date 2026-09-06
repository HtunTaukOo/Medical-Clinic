import { Users, AlertTriangle, ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/authz";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  await requirePageRole(["ADMIN", "STAFF"]);
  const t = await getTranslations("patients");
  const { q } = await searchParams;

  const searchFilter = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { phone: { contains: q, mode: "insensitive" as const } },
          { email: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const patients = await prisma.patient.findMany({
    where: searchFilter,
    orderBy: { createdAt: "desc" },
    include: {
      diagnoses: { where: { status: "ACTIVE" }, orderBy: { createdAt: "desc" }, take: 3 },
      allergyRecords: { select: { id: true } },
      appointments: { orderBy: { scheduledAt: "desc" }, take: 1, select: { scheduledAt: true } },
    },
  });

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-primary">{patients.length}</span> patient
            {patients.length === 1 ? "" : "s"} on record.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-64 sm:w-80">
            <SearchInput placeholder="Search patients or conditions..." />
          </div>
          <Button asChild>
            <Link href="/staff/patients/new">{t("new")}</Link>
          </Button>
        </div>
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

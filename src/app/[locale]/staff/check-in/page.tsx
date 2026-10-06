import { requirePageRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { todayRange } from "@/lib/queue";
import { checkInAppointment } from "@/actions/appointments";
import { calculateAge } from "@/lib/format";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SearchInput } from "@/components/search-input";
import { RegisterWalkInForm } from "@/components/check-in/register-walk-in-form";
import { UserActionDialog } from "@/components/staff/user-action-dialog";
import { Button } from "@/components/ui/button";
import { getTranslations } from "next-intl/server";

export default async function PatientCheckInPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requirePageRole(["ADMIN", "STAFF"]);
  const t = await getTranslations("staffCheckIn");
  const { q } = await searchParams;
  const { start: todayStart, end: todayEnd } = todayRange();

  const trimmedQuery = q?.trim() ?? "";
  const [matches, doctors, bookByServiceSpecialties, blockCapacitySpecialties, labServices, labTests] = await Promise.all([
    trimmedQuery.length >= 2
      ? prisma.patient.findMany({
          where: {
            OR: [
              { name: { contains: trimmedQuery, mode: "insensitive" } },
              { patientCode: { contains: trimmedQuery, mode: "insensitive" } },
              { phone: { contains: trimmedQuery, mode: "insensitive" } },
            ],
          },
          include: {
            appointments: {
              where: { scheduledAt: { gte: todayStart, lt: todayEnd } },
              include: { doctor: { include: { user: true } } },
            },
          },
          orderBy: { name: "asc" },
          take: 10,
        })
      : Promise.resolve([]),
    prisma.doctorProfile.findMany({ include: { user: true }, orderBy: { user: { name: "asc" } } }),
    prisma.specialty.findMany({ where: { bookingMode: "SERVICE_CAPACITY" }, select: { name: true } }),
    prisma.specialty.findMany({ where: { bookingMode: "BLOCK_CAPACITY" }, select: { name: true } }),
    prisma.clinicService.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.labTest.findMany({ orderBy: { name: "asc" } }),
  ]);

  const serviceSpecialtyNames = new Set(bookByServiceSpecialties.map((s) => s.name));
  const realDoctors = doctors.filter((d) => !d.specialty || !serviceSpecialtyNames.has(d.specialty));

  const walkInFormShared = {
    doctors: realDoctors.map((d) => ({ id: d.id, name: d.user.name, specialty: d.specialty })),
    bookByServiceSpecialties: bookByServiceSpecialties.map((s) => s.name),
    blockCapacitySpecialties: blockCapacitySpecialties.map((s) => s.name),
    clinicServices: labServices.map((s) => ({ id: s.id, name: s.name, specialty: s.specialty })),
    labTests: labTests.map((t) => ({
      id: t.id,
      name: t.name,
      unit: t.unit,
      normalRange: t.normalRange,
      price: Number(t.price),
      category: t.category,
    })),
  };

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("description")}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("searchTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <SearchInput placeholder={t("searchPlaceholder")} />

            {trimmedQuery.length < 2 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t("minimumSearch")}
              </p>
            ) : matches.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t("noMatches", { query: trimmedQuery })}
              </p>
            ) : (
              <div className="grid gap-2">
                {matches.map((patient) => {
                  // Only an unresolved appointment (not yet completed,
                  // cancelled, or a no-show) should block a fresh walk-in
                  // registration — a COMPLETED/CANCELLED/NO_SHOW visit today
                  // shouldn't hide the option, same definition of "active"
                  // used by registerAndCheckIn's own server-side check.
                  const todaysAppointment = patient.appointments.find((a) =>
                    ["REQUESTED", "CONFIRMED", "CHECKED_IN"].includes(a.status)
                  );
                  const age = calculateAge(patient.dob);
                  return (
                    <div
                      key={patient.id}
                      className="flex items-center justify-between gap-3 rounded-lg border p-3"
                    >
                      <div>
                        <Link
                          href={`/staff/patients/${patient.id}`}
                          className="font-medium underline underline-offset-2"
                        >
                          {patient.name}
                        </Link>
                        <p className="text-sm text-muted-foreground">
                          {[age != null ? t("yearsOld", { age }) : null, patient.patientCode, patient.phone]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      {!todaysAppointment ? (
                        <UserActionDialog
                          title={t("registerWalkInTitle", { name: patient.name })}
                          trigger={
                            <Button size="sm" variant="outline">
                              {t("registerAsWalkIn")}
                            </Button>
                          }
                        >
                          <RegisterWalkInForm
                            {...walkInFormShared}
                            existingPatient={{ id: patient.id, name: patient.name }}
                          />
                        </UserActionDialog>
                      ) : todaysAppointment.status === "CONFIRMED" ? (
                        <form action={checkInAppointment.bind(null, todaysAppointment.id)}>
                          <button
                            type="submit"
                            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                          >
                            {t("checkIn")}
                          </button>
                        </form>
                      ) : todaysAppointment.status === "CHECKED_IN" ? (
                        <Badge className="bg-emerald-100 text-emerald-700">{t("alreadyCheckedIn")}</Badge>
                      ) : (
                        <Badge variant="outline">{todaysAppointment.status}</Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("walkInRegistration")}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {t("walkInDescription")}
            </p>
          </CardHeader>
          <CardContent>
            <RegisterWalkInForm {...walkInFormShared} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

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

export default async function PatientCheckInPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requirePageRole(["ADMIN", "STAFF"]);
  const { q } = await searchParams;
  const { start: todayStart, end: todayEnd } = todayRange();

  const trimmedQuery = q?.trim() ?? "";
  const [matches, doctors] = await Promise.all([
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
  ]);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Patient Check-In</h1>
        <p className="text-sm text-muted-foreground">
          Search for a patient or register a new walk-in visit.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Patient Check-In</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <SearchInput placeholder="Search patient by name or ID..." />

            {trimmedQuery.length < 2 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Type at least 2 characters to search
              </p>
            ) : matches.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No patients match &ldquo;{trimmedQuery}&rdquo;.
              </p>
            ) : (
              <div className="grid gap-2">
                {matches.map((patient) => {
                  const todaysAppointment = patient.appointments[0];
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
                          {[age != null ? `${age}yo` : null, patient.patientCode, patient.phone]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      {!todaysAppointment ? (
                        <Badge variant="outline">No appointment today</Badge>
                      ) : todaysAppointment.status === "CONFIRMED" ? (
                        <form action={checkInAppointment.bind(null, todaysAppointment.id)}>
                          <button
                            type="submit"
                            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                          >
                            Check In
                          </button>
                        </form>
                      ) : todaysAppointment.status === "CHECKED_IN" ? (
                        <Badge className="bg-emerald-100 text-emerald-700">Already checked in</Badge>
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
            <CardTitle>Walk-in Registration</CardTitle>
            <p className="text-sm text-muted-foreground">
              Register a new patient and check them in immediately.
            </p>
          </CardHeader>
          <CardContent>
            <RegisterWalkInForm doctors={doctors.map((d) => ({ id: d.id, name: d.user.name }))} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

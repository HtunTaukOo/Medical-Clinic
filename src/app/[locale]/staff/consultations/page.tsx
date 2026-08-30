import { Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/authz";
import { todayRange } from "@/lib/queue";
import { initials, calculateAge } from "@/lib/format";
import { isAppointmentUrgent } from "@/lib/clinical-alerts";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/empty-state";
import { GENDER_LETTER, AVATAR_COLORS } from "@/components/appointments/appointment-row";
import { cn } from "@/lib/utils";

function waitingMinutes(checkedInAt: Date | null, now: Date) {
  if (!checkedInAt) return 0;
  return Math.max(0, Math.round((now.getTime() - checkedInAt.getTime()) / 60000));
}

export default async function ConsultationsPage() {
  const session = await requirePageRole(["DOCTOR"]);
  const doctorId = session.user.doctorId;
  const { start, end } = todayRange();
  const now = new Date();

  const appointments = doctorId
    ? await prisma.appointment.findMany({
        where: {
          doctorId,
          scheduledAt: { gte: start, lt: end },
          status: { in: ["CHECKED_IN", "COMPLETED"] },
        },
        include: {
          patient: {
            include: {
              allergyRecords: { orderBy: { createdAt: "desc" } },
              diagnoses: { where: { status: "ACTIVE" }, orderBy: { createdAt: "desc" }, take: 1 },
            },
          },
          diagnoses: { orderBy: { createdAt: "desc" }, take: 1 },
        },
        orderBy: { scheduledAt: "asc" },
      })
    : [];

  const waiting = appointments
    .filter((a) => a.status === "CHECKED_IN")
    .sort((a, b) => (a.checkedInAt?.getTime() ?? 0) - (b.checkedInAt?.getTime() ?? 0));
  const completed = appointments.filter((a) => a.status === "COMPLETED");

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Consultations</h1>
        <p className="text-muted-foreground">Start and manage patient consultations for today.</p>
      </div>

      <Tabs defaultValue="waiting">
        <TabsList>
          <TabsTrigger
            value="waiting"
            className="data-active:bg-primary data-active:text-primary-foreground"
          >
            Waiting
            <Badge variant="secondary" className="ml-1">
              {waiting.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger
            value="completed"
            className="data-active:bg-primary data-active:text-primary-foreground"
          >
            Completed Today
            <Badge variant="secondary" className="ml-1">
              {completed.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="waiting" className="grid gap-3">
          {waiting.length === 0 ? (
            <EmptyState icon={Clock} message="No one waiting." />
          ) : (
            waiting.map((appt, index) => {
              const age = calculateAge(appt.patient.dob);
              const genderLetter = appt.patient.gender ? GENDER_LETTER[appt.patient.gender] : null;
              const urgent = isAppointmentUrgent({
                ...appt,
                patient: {
                  ...appt.patient,
                  allergyRecords: appt.patient.allergyRecords.filter((a) => a.severity === "SEVERE"),
                },
              });
              const minutes = waitingMinutes(appt.checkedInAt, now);
              return (
                <div
                  key={appt.id}
                  className={cn(
                    "flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4",
                    urgent ? "border-red-300 bg-red-50" : "bg-card"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="size-11">
                      <AvatarFallback className={AVATAR_COLORS[index % AVATAR_COLORS.length]}>
                        {initials(appt.patient.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">
                          {appt.patient.name}
                          {(age != null || genderLetter) && (
                            <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                              · {age != null ? `${age}yo` : ""} {genderLetter ?? ""}
                            </span>
                          )}
                        </p>
                        <Badge variant="outline" className="gap-1 bg-amber-100 text-amber-700">
                          <Clock className="size-3" />
                          Waiting {minutes} min
                        </Badge>
                        {urgent && (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="size-3" />
                            URGENT
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{appt.reason || "No reason given"}</p>
                      {appt.patient.allergyRecords.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {appt.patient.allergyRecords.map((a) => (
                            <Badge key={a.id} variant="outline" className="gap-1 bg-amber-50 text-amber-700">
                              <AlertTriangle className="size-3" />
                              {a.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <Button
                    asChild
                    className={urgent ? "bg-red-600 text-white hover:bg-red-700" : "bg-emerald-600 text-white hover:bg-emerald-700"}
                  >
                    <Link href={`/staff/appointments/${appt.id}`}>Start</Link>
                  </Button>
                </div>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="completed" className="grid gap-3">
          {completed.length === 0 ? (
            <EmptyState icon={CheckCircle2} message="No consultations completed yet today." />
          ) : (
            completed.map((appt, index) => {
              const age = calculateAge(appt.patient.dob);
              const diagnosis = appt.diagnoses[0]?.description;
              return (
                <Link
                  key={appt.id}
                  href={`/staff/appointments/${appt.id}`}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-4 hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="size-11">
                      <AvatarFallback className={AVATAR_COLORS[index % AVATAR_COLORS.length]}>
                        {initials(appt.patient.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">
                          {appt.patient.name}
                          {age != null && (
                            <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                              · {age}yo
                            </span>
                          )}
                        </p>
                        <span className="text-sm text-muted-foreground">
                          {appt.scheduledAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <Badge variant="outline" className="bg-indigo-100 text-indigo-700">
                          Completed
                        </Badge>
                      </div>
                      {diagnosis && <p className="text-sm text-muted-foreground">{diagnosis}</p>}
                      {appt.treatmentPlan && (
                        <p className="text-sm text-muted-foreground italic">{appt.treatmentPlan}</p>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

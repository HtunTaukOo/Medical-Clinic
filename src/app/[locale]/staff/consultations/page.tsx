import { Clock, Stethoscope, CheckCircle2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/authz";
import { todayRange } from "@/lib/queue";
import { initials } from "@/lib/format";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/empty-state";

export default async function ConsultationsPage() {
  const session = await requirePageRole(["DOCTOR"]);
  const doctorId = session.user.doctorId;
  const { start, end } = todayRange();

  const appointments = doctorId
    ? await prisma.appointment.findMany({
        where: {
          doctorId,
          scheduledAt: { gte: start, lt: end },
          status: { in: ["CONFIRMED", "CHECKED_IN", "COMPLETED"] },
        },
        include: { patient: true },
        orderBy: { scheduledAt: "asc" },
      })
    : [];

  const waiting = appointments.filter((a) => a.status === "CONFIRMED");
  const inProgress = appointments
    .filter((a) => a.status === "CHECKED_IN")
    .sort((a, b) => (a.checkedInAt?.getTime() ?? 0) - (b.checkedInAt?.getTime() ?? 0));
  const completed = appointments.filter((a) => a.status === "COMPLETED");

  const groups = [
    { value: "waiting", label: "Waiting", icon: Clock, rows: waiting, empty: "No one waiting." },
    {
      value: "in-progress",
      label: "In Progress",
      icon: Stethoscope,
      rows: inProgress,
      empty: "No consultation in progress.",
    },
    {
      value: "completed",
      label: "Completed",
      icon: CheckCircle2,
      rows: completed,
      empty: "No consultations completed yet today.",
    },
  ] as const;

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Consultations</h1>
        <p className="text-muted-foreground">Today&apos;s patients, grouped by consultation stage.</p>
      </div>

      <Tabs defaultValue="waiting">
        <TabsList>
          {groups.map((group) => (
            <TabsTrigger key={group.value} value={group.value}>
              {group.label}
              <Badge variant="secondary" className="ml-1">
                {group.rows.length}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        {groups.map((group) => (
          <TabsContent key={group.value} value={group.value}>
            <Card>
              <CardContent className="grid gap-2">
                {group.rows.length === 0 ? (
                  <EmptyState icon={group.icon} message={group.empty} />
                ) : (
                  group.rows.map((appt) => (
                    <Link
                      key={appt.id}
                      href={`/staff/appointments/${appt.id}`}
                      className="flex items-center justify-between gap-3 rounded-lg border p-3 hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="size-10">
                          <AvatarFallback className="bg-secondary text-secondary-foreground">
                            {initials(appt.patient.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{appt.patient.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {appt.reason || "No reason given"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right text-sm text-muted-foreground">
                        {group.value === "in-progress" && appt.checkedInAt
                          ? `Checked in ${appt.checkedInAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                          : appt.scheduledAt.toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                      </div>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

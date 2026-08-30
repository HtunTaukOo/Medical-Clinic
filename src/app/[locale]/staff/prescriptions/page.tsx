import { Pill, ClipboardPlus, History } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/authz";
import { dateKey } from "@/lib/calendar";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/empty-state";

export default async function PrescriptionsPage() {
  const session = await requirePageRole(["DOCTOR"]);
  const doctorId = session.user.doctorId;
  const todayKey = dateKey(new Date());

  const [eligibleAppointments, active, history] = doctorId
    ? await Promise.all([
        prisma.appointment.findMany({
          where: { doctorId, status: { in: ["CHECKED_IN", "COMPLETED"] } },
          include: { patient: true },
          orderBy: { scheduledAt: "desc" },
          take: 20,
        }),
        prisma.prescription.findMany({
          where: { doctorId, fulfilled: false },
          include: { patient: true, items: { include: { medicine: true } } },
          orderBy: { createdAt: "desc" },
        }),
        prisma.prescription.findMany({
          where: { doctorId, fulfilled: true },
          include: { patient: true, items: { include: { medicine: true } } },
          orderBy: { createdAt: "desc" },
          take: 30,
        }),
      ])
    : [[], [], []];

  const eligibleToday = eligibleAppointments.filter(
    (appt) => dateKey(appt.scheduledAt) === todayKey
  );

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Prescriptions</h1>
        <p className="text-muted-foreground">Write, track, and review your patients&apos; prescriptions.</p>
      </div>

      <Tabs defaultValue="create">
        <TabsList>
          <TabsTrigger
            value="create"
            className="data-active:bg-primary data-active:text-primary-foreground"
          >
            Create Prescription
          </TabsTrigger>
          <TabsTrigger
            value="active"
            className="data-active:bg-primary data-active:text-primary-foreground"
          >
            Active
            <Badge variant="secondary" className="ml-1">
              {active.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="data-active:bg-primary data-active:text-primary-foreground"
          >
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="create">
          <Card>
            <CardContent className="grid gap-2">
              {eligibleToday.length === 0 ? (
                <EmptyState
                  icon={ClipboardPlus}
                  message="No patients checked in today are ready for a prescription yet."
                />
              ) : (
                eligibleToday.map((appt) => (
                  <div
                    key={appt.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-medium">{appt.patient.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {appt.scheduledAt.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        &mdash; {appt.status === "CHECKED_IN" ? "In consultation" : "Completed"}
                      </p>
                    </div>
                    <Button asChild size="sm">
                      <Link href={`/staff/appointments/${appt.id}`}>Prescribe</Link>
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="active">
          <Card>
            <CardContent className="grid gap-3">
              {active.length === 0 ? (
                <EmptyState icon={Pill} message="No active prescriptions." />
              ) : (
                active.map((rx) => (
                  <Link
                    key={rx.id}
                    href={`/staff/appointments/${rx.appointmentId}`}
                    className="rounded-lg border p-3 hover:bg-muted/50"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <p className="font-medium">{rx.patient.name}</p>
                      <Badge variant="outline">
                        {new Date(rx.createdAt).toLocaleDateString()}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {rx.items.map((item) => item.medicine.name).join(", ")}
                    </p>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardContent className="grid gap-3">
              {history.length === 0 ? (
                <EmptyState icon={History} message="No fulfilled prescriptions yet." />
              ) : (
                history.map((rx) => (
                  <Link
                    key={rx.id}
                    href={`/staff/appointments/${rx.appointmentId}`}
                    className="rounded-lg border p-3 hover:bg-muted/50"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <p className="font-medium">{rx.patient.name}</p>
                      <Badge variant="success">
                        Fulfilled {rx.fulfilledAt ? new Date(rx.fulfilledAt).toLocaleDateString() : ""}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {rx.items.map((item) => item.medicine.name).join(", ")}
                    </p>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

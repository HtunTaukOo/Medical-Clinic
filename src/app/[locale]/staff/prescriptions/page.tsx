import { Pill, Clock, Hourglass, RotateCw, History as HistoryIcon } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/authz";
import { initials } from "@/lib/format";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/empty-state";
import { AVATAR_COLORS } from "@/components/appointments/appointment-row";

export default async function PrescriptionsPage() {
  const session = await requirePageRole(["DOCTOR"]);
  const doctorId = session.user.doctorId;

  const [active, history] = doctorId
    ? await Promise.all([
        prisma.prescription.findMany({
          where: { doctorId, fulfilled: false },
          include: { patient: true, items: { include: { medicine: true } } },
          orderBy: { createdAt: "desc" },
        }),
        prisma.prescription.findMany({
          where: { doctorId, fulfilled: true },
          include: { patient: true, items: { include: { medicine: true } } },
          orderBy: { fulfilledAt: "desc" },
          take: 30,
        }),
      ])
    : [[], []];

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Prescriptions</h1>
        <p className="text-muted-foreground">
          Review and manage patient prescriptions. Write new ones from a{" "}
          <Link href="/staff/consultations" className="text-primary underline">
            patient&apos;s consultation
          </Link>
          .
        </p>
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger
            value="active"
            className="data-active:bg-primary data-active:text-primary-foreground"
          >
            Active ({active.length})
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="data-active:bg-primary data-active:text-primary-foreground"
          >
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="grid gap-3">
          {active.length === 0 ? (
            <EmptyState icon={Pill} message="No active prescriptions." />
          ) : (
            active.map((rx, index) =>
              rx.items.map((item) => (
                <div key={item.id} className="rounded-xl border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-600">
                        <Pill className="size-5" />
                      </div>
                      <div>
                        <p className="font-semibold">{item.medicine.name}</p>
                        <div className="mt-0.5 flex items-center gap-2">
                          <Avatar className="size-5">
                            <AvatarFallback
                              className={`text-[10px] ${AVATAR_COLORS[index % AVATAR_COLORS.length]}`}
                            >
                              {initials(rx.patient.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm text-muted-foreground">{rx.patient.name}</span>
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Pill className="size-3.5" />
                            {item.dosage}
                          </span>
                          {item.frequency && (
                            <span className="flex items-center gap-1">
                              <Clock className="size-3.5" />
                              {item.frequency}
                            </span>
                          )}
                          {(item.duration || item.durationDays) && (
                            <span className="flex items-center gap-1">
                              <Hourglass className="size-3.5" />
                              {item.duration ?? `${item.durationDays} days`}
                            </span>
                          )}
                          {item.refillsLeft != null && (
                            <Badge variant="outline" className="gap-1 bg-blue-50 text-blue-700">
                              <RotateCw className="size-3" />
                              {item.refillsLeft} refill{item.refillsLeft === 1 ? "" : "s"} left
                            </Badge>
                          )}
                        </div>
                        {item.instructions && (
                          <p className="mt-1.5 text-sm text-muted-foreground italic">
                            {item.instructions}
                          </p>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-blue-100 text-blue-700">
                      Active
                    </Badge>
                  </div>
                </div>
              ))
            )
          )}
        </TabsContent>

        <TabsContent value="history" className="grid gap-3">
          {history.length === 0 ? (
            <EmptyState icon={HistoryIcon} message="No fulfilled prescriptions yet." />
          ) : (
            history.map((rx, index) =>
              rx.items.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="size-10">
                      <AvatarFallback className={AVATAR_COLORS[index % AVATAR_COLORS.length]}>
                        {initials(rx.patient.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{item.medicine.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {rx.patient.name}
                        {" · "}
                        {item.dosage}
                        {item.frequency && ` · ${item.frequency}`}
                        {(item.duration || item.durationDays) &&
                          ` · ${item.duration ?? `${item.durationDays} days`}`}
                      </p>
                      {rx.fulfilledAt && (
                        <p className="text-xs text-muted-foreground">
                          {rx.fulfilledAt.toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-indigo-100 text-indigo-700">
                    Completed
                  </Badge>
                </div>
              ))
            )
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

import type { ReactNode } from "react";
import { Megaphone } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/authz";
import { todayRange } from "@/lib/queue";
import {
  checkInAppointment,
  completeAppointment,
  markNoShow,
} from "@/actions/appointments";
import { callWalkIn, cancelWalkIn } from "@/actions/walk-ins";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

type ColumnKey = "WAITING" | "CALLED" | "IN_CONSULTATION" | "COMPLETED" | "MISSED";

type QueueCard = {
  key: string;
  queuedAt: number;
  time: Date;
  patientName: string;
  doctorName: string;
  specialty: string | null;
  column: ColumnKey;
  action: ReactNode | null;
};

const COLUMN_META: Record<
  ColumnKey,
  { label: string; headerClass: string; numberClass: string }
> = {
  WAITING: { label: "Waiting", headerClass: "bg-amber-500", numberClass: "text-amber-600" },
  CALLED: { label: "Called", headerClass: "bg-blue-500", numberClass: "text-blue-600" },
  IN_CONSULTATION: {
    label: "In Consultation",
    headerClass: "bg-purple-500",
    numberClass: "text-purple-600",
  },
  COMPLETED: {
    label: "Completed",
    headerClass: "bg-emerald-500",
    numberClass: "text-emerald-600",
  },
  MISSED: { label: "Missed", headerClass: "bg-rose-500", numberClass: "text-rose-600" },
};

const COLUMN_ORDER: ColumnKey[] = ["WAITING", "CALLED", "IN_CONSULTATION", "COMPLETED", "MISSED"];

function ActionButton({
  formAction,
  variant,
  children,
}: {
  formAction: (formData: FormData) => void;
  variant: "blue" | "purple" | "emerald";
  children: ReactNode;
}) {
  const classes = {
    blue: "bg-blue-100 text-blue-700 hover:bg-blue-200",
    purple: "bg-purple-100 text-purple-700 hover:bg-purple-200",
    emerald: "bg-emerald-100 text-emerald-700 hover:bg-emerald-200",
  }[variant];
  return (
    <form action={formAction} className="flex-1">
      <button
        type="submit"
        className={`w-full rounded-md px-2 py-1 text-xs font-semibold ${classes}`}
      >
        {children}
      </button>
    </form>
  );
}

export default async function QueuePage() {
  await requirePageRole(["ADMIN", "STAFF"]);
  const t = await getTranslations("appointments");
  const { start, end } = todayRange();

  const [appointments, walkIns] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        scheduledAt: { gte: start, lt: end },
        status: { in: ["CONFIRMED", "CHECKED_IN", "COMPLETED", "NO_SHOW"] },
      },
      include: { patient: true, doctor: { include: { user: true } } },
    }),
    prisma.walkIn.findMany({
      where: { createdAt: { gte: start, lt: end }, status: { in: ["WAITING", "CALLED"] } },
      include: { doctor: { include: { user: true } } },
      orderBy: { tokenNumber: "asc" },
    }),
  ]);

  const confirmed = appointments.filter((a) => a.status === "CONFIRMED");
  const completed = appointments.filter((a) => a.status === "COMPLETED");
  const noShow = appointments.filter((a) => a.status === "NO_SHOW");
  const waitingWalkIns = walkIns.filter((w) => w.status === "WAITING");
  const calledWalkIns = walkIns.filter((w) => w.status === "CALLED");

  // "In consultation" isn't a stored status — it's the earliest checked-in
  // patient per doctor, computed at render time. Once that appointment is
  // completed, the next-earliest checked-in patient for that doctor becomes
  // "in consultation" automatically on the next load, with no extra state.
  const checkedInByDoctor = new Map<string, typeof appointments>();
  for (const appt of appointments.filter((a) => a.status === "CHECKED_IN")) {
    const list = checkedInByDoctor.get(appt.doctorId) ?? [];
    list.push(appt);
    checkedInByDoctor.set(appt.doctorId, list);
  }
  const inConsultation: typeof appointments = [];
  const stillCheckedIn: typeof appointments = [];
  for (const list of checkedInByDoctor.values()) {
    const sorted = [...list].sort(
      (a, b) => (a.checkedInAt?.getTime() ?? 0) - (b.checkedInAt?.getTime() ?? 0)
    );
    inConsultation.push(sorted[0]);
    stillCheckedIn.push(...sorted.slice(1));
  }

  const cards: QueueCard[] = [
    ...confirmed.map(
      (appt): QueueCard => ({
        key: `confirmed-${appt.id}`,
        queuedAt: appt.scheduledAt.getTime(),
        time: appt.scheduledAt,
        patientName: appt.patient.name,
        doctorName: appt.doctor.user.name,
        specialty: appt.doctor.specialty,
        column: "WAITING",
        action: (
          <>
            <ActionButton formAction={checkInAppointment.bind(null, appt.id)} variant="blue">
              Call In
            </ActionButton>
            <form action={markNoShow.bind(null, appt.id)}>
              <button
                type="submit"
                className="px-2 py-1 text-xs font-semibold text-rose-600 hover:text-rose-700"
              >
                Miss
              </button>
            </form>
          </>
        ),
      })
    ),
    ...stillCheckedIn.map(
      (appt): QueueCard => ({
        key: `waiting-checkedin-${appt.id}`,
        queuedAt: (appt.checkedInAt ?? appt.scheduledAt).getTime(),
        time: appt.scheduledAt,
        patientName: appt.patient.name,
        doctorName: appt.doctor.user.name,
        specialty: appt.doctor.specialty,
        column: "WAITING",
        action: null,
      })
    ),
    ...waitingWalkIns.map(
      (walkIn): QueueCard => ({
        key: `walkin-waiting-${walkIn.id}`,
        queuedAt: walkIn.createdAt.getTime(),
        time: walkIn.createdAt,
        patientName: walkIn.name || t("anonymousWalkIn"),
        doctorName: walkIn.doctor?.user.name ?? "Any doctor",
        specialty: walkIn.doctor?.specialty ?? null,
        column: "WAITING",
        action: (
          <>
            <ActionButton formAction={callWalkIn.bind(null, walkIn.id)} variant="blue">
              Call In
            </ActionButton>
            <form action={cancelWalkIn.bind(null, walkIn.id)}>
              <button
                type="submit"
                className="px-2 py-1 text-xs font-semibold text-rose-600 hover:text-rose-700"
              >
                Miss
              </button>
            </form>
          </>
        ),
      })
    ),
    ...calledWalkIns.map(
      (walkIn): QueueCard => ({
        key: `walkin-called-${walkIn.id}`,
        queuedAt: (walkIn.calledAt ?? walkIn.createdAt).getTime(),
        time: walkIn.createdAt,
        patientName: walkIn.name || t("anonymousWalkIn"),
        doctorName: walkIn.doctor?.user.name ?? "Any doctor",
        specialty: walkIn.doctor?.specialty ?? null,
        column: "CALLED",
        action: (
          <Link
            href={`/staff/queue/walk-ins/${walkIn.id}`}
            className="flex-1 rounded-md bg-purple-100 px-2 py-1 text-center text-xs font-semibold text-purple-700 hover:bg-purple-200"
          >
            Start
          </Link>
        ),
      })
    ),
    ...inConsultation.map(
      (appt): QueueCard => ({
        key: `consult-${appt.id}`,
        queuedAt: (appt.checkedInAt ?? appt.scheduledAt).getTime(),
        time: appt.scheduledAt,
        patientName: appt.patient.name,
        doctorName: appt.doctor.user.name,
        specialty: appt.doctor.specialty,
        column: "IN_CONSULTATION",
        action: (
          <ActionButton formAction={completeAppointment.bind(null, appt.id)} variant="emerald">
            Mark Done
          </ActionButton>
        ),
      })
    ),
    ...completed.map(
      (appt): QueueCard => ({
        key: `completed-${appt.id}`,
        queuedAt: (appt.checkedInAt ?? appt.scheduledAt).getTime(),
        time: appt.scheduledAt,
        patientName: appt.patient.name,
        doctorName: appt.doctor.user.name,
        specialty: appt.doctor.specialty,
        column: "COMPLETED",
        action: null,
      })
    ),
    ...noShow.map(
      (appt): QueueCard => ({
        key: `noshow-${appt.id}`,
        queuedAt: appt.scheduledAt.getTime(),
        time: appt.scheduledAt,
        patientName: appt.patient.name,
        doctorName: appt.doctor.user.name,
        specialty: appt.doctor.specialty,
        column: "MISSED",
        action: null,
      })
    ),
  ];

  const numbered = [...cards]
    .sort((a, b) => a.queuedAt - b.queuedAt)
    .map((card, index) => ({ ...card, queueNumber: index + 1 }));

  const columns: Record<ColumnKey, (QueueCard & { queueNumber: number })[]> = {
    WAITING: [],
    CALLED: [],
    IN_CONSULTATION: [],
    COMPLETED: [],
    MISSED: [],
  };
  for (const card of numbered) {
    columns[card.column].push(card);
  }
  for (const column of COLUMN_ORDER) {
    columns[column].sort((a, b) => a.queueNumber - b.queueNumber);
  }

  const today = new Date();

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Queue Status Board</h1>
          <p className="text-sm text-muted-foreground">
            Track patients through the visit workflow in real time.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">
            Today — {today.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
          </p>
          <Button asChild>
            <Link href="/queue-display" target="_blank">
              <Megaphone className="size-4" />
              {t("queueDisplay")}
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {COLUMN_ORDER.map((column) => {
          const meta = COLUMN_META[column];
          const columnCards = columns[column];
          return (
            <div key={column} className="grid content-start gap-3">
              <div
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-white ${meta.headerClass}`}
              >
                <span className="font-semibold">{meta.label}</span>
                <span className="flex size-6 items-center justify-center rounded-full bg-white/25 text-sm font-bold">
                  {columnCards.length}
                </span>
              </div>

              {columnCards.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Empty
                </div>
              ) : (
                columnCards.map((card) => (
                  <div key={card.key} className="rounded-lg border bg-card p-3 shadow-sm">
                    <div className="mb-1 flex items-center justify-between">
                      <span className={`font-bold ${meta.numberClass}`}>
                        #{String(card.queueNumber).padStart(2, "0")}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {card.time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="font-semibold">{card.patientName}</p>
                    <p className="text-sm text-muted-foreground">{card.doctorName}</p>
                    {card.specialty && (
                      <p className="text-xs text-muted-foreground">{card.specialty}</p>
                    )}
                    {card.action && <div className="mt-3 flex gap-2">{card.action}</div>}
                  </div>
                ))
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

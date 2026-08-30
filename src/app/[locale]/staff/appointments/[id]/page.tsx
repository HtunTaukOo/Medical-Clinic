import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/authz";
import {
  confirmAppointment,
  checkInAppointment,
  cancelAppointment,
  completeAppointment,
  markNoShow,
} from "@/actions/appointments";
import { createPrescription } from "@/actions/prescriptions";
import { PrescriptionForm } from "@/components/prescriptions/prescription-form";
import { NoteForm } from "@/components/medical-records/note-form";
import { OrderLabTestsForm } from "@/components/lab/order-lab-tests-form";
import { DiagnosisForm } from "@/components/diagnoses/diagnosis-form";
import { DiagnosisList } from "@/components/diagnoses/diagnosis-list";
import { AllergyList } from "@/components/allergies/allergy-list";
import { ConsultationForm, CONSULTATION_FORM_ID } from "@/components/consultations/consultation-form";
import { ConsultationSidebar } from "@/components/consultations/consultation-sidebar";
import { ConsultationQuickActions } from "@/components/consultations/consultation-quick-actions";
import { dateKey } from "@/lib/calendar";
import { calculateAge } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Link } from "@/i18n/navigation";
import { CalendarPlus, ChevronLeft } from "lucide-react";
import { initials } from "@/lib/format";
import { GENDER_LETTER, AVATAR_COLORS } from "@/components/appointments/appointment-row";

const CONSULTATION_STATUS_LABEL: Record<string, string> = {
  REQUESTED: "Requested",
  CONFIRMED: "Confirmed",
  CHECKED_IN: "In Progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No-show",
};

const CONSULTATION_STATUS_CLASS: Record<string, string> = {
  REQUESTED: "bg-slate-100 text-slate-700",
  CONFIRMED: "bg-slate-100 text-slate-700",
  CHECKED_IN: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-indigo-100 text-indigo-700",
  CANCELLED: "bg-rose-100 text-rose-700",
  NO_SHOW: "bg-rose-100 text-rose-700",
};

export default async function AppointmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePageRole(["ADMIN", "DOCTOR", "RECEPTIONIST"]);
  const { id } = await params;
  const t = await getTranslations("appointments");
  const tBilling = await getTranslations("billing");

  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: {
      patient: {
        include: {
          allergyRecords: { orderBy: { createdAt: "desc" } },
          diagnoses: { where: { status: "ACTIVE" }, orderBy: { createdAt: "desc" } },
          prescriptions: {
            orderBy: { createdAt: "desc" },
            include: { items: { include: { medicine: true } } },
          },
          appointments: {
            where: { status: "COMPLETED", NOT: { id } },
            orderBy: { scheduledAt: "desc" },
            take: 1,
            select: { scheduledAt: true, notes: true },
          },
        },
      },
      doctor: { include: { user: true } },
      prescriptions: { include: { items: { include: { medicine: true } } } },
      invoice: true,
      labOrders: { include: { items: { include: { labTest: true } } } },
      diagnoses: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!appointment) notFound();

  if (session.user.role === "DOCTOR" && appointment.doctorId !== session.user.doctorId) {
    notFound();
  }

  const isOwnDoctor =
    session.user.role === "DOCTOR" && appointment.doctorId === session.user.doctorId;
  const canWriteNote =
    isOwnDoctor &&
    (appointment.status === "CONFIRMED" ||
      appointment.status === "CHECKED_IN" ||
      appointment.status === "COMPLETED");
  const isSameDayAsVisit = dateKey(appointment.scheduledAt) === dateKey(new Date());
  const canPrescribe = canWriteNote && isSameDayAsVisit;

  const medicines = canPrescribe
    ? await prisma.medicine.findMany({ orderBy: { name: "asc" } })
    : [];
  const labTests = canPrescribe
    ? await prisma.labTest.findMany({ orderBy: { name: "asc" } })
    : [];

  const boundCreatePrescription = createPrescription.bind(null, appointment.id);

  if (isOwnDoctor && canWriteNote) {
    const age = calculateAge(appointment.patient.dob);
    const genderLetter = appointment.patient.gender ? GENDER_LETTER[appointment.patient.gender] : null;
    const now = new Date();
    const activeMedications = appointment.patient.prescriptions
      .filter((rx) => {
        const maxDuration = Math.max(0, ...rx.items.map((i) => i.durationDays ?? 0));
        if (maxDuration === 0) return false;
        const start = rx.fulfilledAt ?? rx.createdAt;
        return start.getTime() + maxDuration * 86400000 > now.getTime();
      })
      .flatMap((rx) => rx.items);
    const lastVisit = appointment.patient.appointments[0];
    const lastVisitNote = lastVisit?.notes
      ? { note: lastVisit.notes, date: lastVisit.scheduledAt }
      : null;
    const isCompleted = appointment.status === "COMPLETED";

    return (
      <div className="grid gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/staff/consultations"
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="size-4" />
              Back
            </Link>
            <Avatar className="size-9">
              <AvatarFallback className={AVATAR_COLORS[0]}>
                {initials(appointment.patient.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{appointment.patient.name}</span>
                <Badge variant="outline" className={CONSULTATION_STATUS_CLASS[appointment.status]}>
                  {CONSULTATION_STATUS_LABEL[appointment.status]}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {[age != null ? `${age}yo` : null, genderLetter, appointment.patient.bloodType]
                  .filter(Boolean)
                  .join(" · ")}
                {appointment.reason ? ` · ${appointment.reason}` : ""}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              type="submit"
              form={CONSULTATION_FORM_ID}
              name="intent"
              value="draft"
              variant="outline"
            >
              Save Draft
            </Button>
            {!isCompleted && (
              <Button type="submit" form={CONSULTATION_FORM_ID} name="intent" value="complete">
                Complete
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <ConsultationSidebar
            allergies={appointment.patient.allergyRecords}
            activeConditions={appointment.patient.diagnoses}
            currentMedications={activeMedications}
            lastVisitNote={lastVisitNote}
          />

          <div className="grid gap-8">
            <ConsultationForm
              appointmentId={appointment.id}
              defaultValues={{
                bpSystolic: appointment.bpSystolic,
                bpDiastolic: appointment.bpDiastolic,
                heartRateBpm: appointment.heartRateBpm,
                temperatureC: appointment.temperatureC ? Number(appointment.temperatureC) : null,
                spo2Percent: appointment.spo2Percent,
                weightKg: appointment.weightKg,
                heightCm: appointment.heightCm,
                chiefComplaint: appointment.chiefComplaint,
                symptoms: appointment.symptoms,
                physicalExam: appointment.physicalExam,
                clinicalNotes: appointment.notes,
                treatmentPlan: appointment.treatmentPlan,
              }}
              diagnosisSlot={
                <section>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      5
                    </span>
                    <h2 className="font-semibold">Diagnosis</h2>
                  </div>
                  <div className="grid gap-4">
                    <DiagnosisList diagnoses={appointment.diagnoses} canDelete={canPrescribe} />
                    {canPrescribe && <DiagnosisForm appointmentId={appointment.id} />}
                  </div>
                </section>
              }
            />

            {appointment.prescriptions.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-semibold">Prescriptions on this visit</p>
                <div className="grid gap-3">
                  {appointment.prescriptions.map((rx) => (
                    <div key={rx.id} className="rounded-md border p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          {new Date(rx.createdAt).toLocaleString()}
                        </span>
                        <Badge variant={rx.fulfilled ? "success" : "outline"}>
                          {rx.fulfilled ? "Fulfilled" : "Pending"}
                        </Badge>
                      </div>
                      <ul className="text-sm">
                        {rx.items.map((item) => (
                          <li key={item.id}>
                            {item.medicine.name} &mdash; {item.dosage} x{item.quantity}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {appointment.labOrders.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-semibold">Lab orders on this visit</p>
                <div className="grid gap-3">
                  {appointment.labOrders.map((order) => (
                    <div key={order.id} className="rounded-md border p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          {new Date(order.createdAt).toLocaleString()}
                        </span>
                        <Badge variant={order.status === "COMPLETED" ? "success" : "outline"}>
                          {order.status.replace("_", " ")}
                        </Badge>
                      </div>
                      <ul className="text-sm">
                        {order.items.map((item) => (
                          <li key={item.id}>{item.labTest.name}</li>
                        ))}
                      </ul>
                      {order.status === "COMPLETED" && (
                        <Link
                          href={`/lab-report/${order.id}`}
                          className="text-sm underline text-muted-foreground"
                        >
                          View report
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {canPrescribe && (
              <ConsultationQuickActions
                followUpHref={`/staff/appointments/new?patientId=${appointment.patientId}`}
                prescribeSlot={
                  <PrescriptionForm
                    action={boundCreatePrescription}
                    medicines={medicines.map((m) => ({ id: m.id, name: m.name, unit: m.unit }))}
                  />
                }
                labSlot={
                  <OrderLabTestsForm
                    appointmentId={appointment.id}
                    tests={labTests.map((test) => ({
                      id: test.id,
                      name: test.name,
                      price: Number(test.price),
                    }))}
                  />
                }
              />
            )}

            <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
              <Button
                type="submit"
                form={CONSULTATION_FORM_ID}
                name="intent"
                value="draft"
                variant="outline"
              >
                Save Draft
              </Button>
              {!isCompleted && (
                <Button type="submit" form={CONSULTATION_FORM_ID} name="intent" value="complete">
                  Complete Consultation
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{appointment.patient.name}</h1>
          <p className="text-muted-foreground">
            {new Date(appointment.scheduledAt).toLocaleString()} &mdash;{" "}
            {appointment.doctor.user.name}
          </p>
        </div>
        <Badge variant="outline">{appointment.status}</Badge>
      </div>

      {appointment.patient.allergyRecords.length > 0 && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive">Allergies</CardTitle>
          </CardHeader>
          <CardContent>
            <AllergyList allergies={appointment.patient.allergyRecords} />
          </CardContent>
        </Card>
      )}

      {appointment.reason && (
        <Card>
          <CardHeader>
            <CardTitle>{t("reason")}</CardTitle>
          </CardHeader>
          <CardContent>{appointment.reason}</CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        {appointment.status === "REQUESTED" && (
          <form action={confirmAppointment.bind(null, appointment.id)}>
            <Button variant="secondary" type="submit">
              {t("confirm")}
            </Button>
          </form>
        )}
        {appointment.status === "CONFIRMED" && session.user.role !== "DOCTOR" && (
          <form action={checkInAppointment.bind(null, appointment.id)}>
            <Button variant="secondary" type="submit">
              {t("checkIn")}
            </Button>
          </form>
        )}
        {appointment.status === "CONFIRMED" && (
          <form action={markNoShow.bind(null, appointment.id)}>
            <Button variant="outline" type="submit">
              {t("noShow")}
            </Button>
          </form>
        )}
        {(appointment.status === "REQUESTED" ||
          appointment.status === "CONFIRMED" ||
          appointment.status === "CHECKED_IN") && (
          <>
            <form action={completeAppointment.bind(null, appointment.id)}>
              <Button type="submit">{t("complete")}</Button>
            </form>
            <form action={cancelAppointment.bind(null, appointment.id)}>
              <Button variant="destructive" type="submit">
                {t("cancel")}
              </Button>
            </form>
          </>
        )}
        {isOwnDoctor && (
          <Button asChild size="sm" variant="outline">
            <Link href={`/staff/appointments/new?patientId=${appointment.patientId}`}>
              <CalendarPlus className="size-4" />
              Book Follow-up
            </Link>
          </Button>
        )}
      </div>

      {(session.user.role === "ADMIN" || session.user.role === "RECEPTIONIST") &&
        (appointment.status === "CHECKED_IN" || appointment.status === "COMPLETED") && (
          <Card>
            <CardHeader>
              <CardTitle>{tBilling("title")}</CardTitle>
            </CardHeader>
            <CardContent>
              {appointment.invoice ? (
                <div className="flex items-center justify-between">
                  <span>
                    {tBilling("total")}: {Number(appointment.invoice.total).toFixed(2)}
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge variant={appointment.invoice.status === "PAID" ? "success" : "outline"}>
                      {appointment.invoice.status}
                    </Badge>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/staff/billing/${appointment.invoice.id}`}>
                        {tBilling("recordPayment")}
                      </Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <Button asChild size="sm">
                  <Link href={`/staff/billing/new?appointmentId=${appointment.id}`}>
                    {tBilling("newInvoice")}
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        )}

      {(canWriteNote || appointment.bpSystolic || appointment.heartRateBpm) && (
        <Card>
          <CardHeader>
            <CardTitle>Vital Signs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              {appointment.bpSystolic && appointment.bpDiastolic && (
                <p>BP: {appointment.bpSystolic}/{appointment.bpDiastolic} mmHg</p>
              )}
              {appointment.heartRateBpm && <p>HR: {appointment.heartRateBpm} bpm</p>}
              {appointment.temperatureC && <p>Temp: {Number(appointment.temperatureC)}°C</p>}
              {appointment.spo2Percent && <p>SpO2: {appointment.spo2Percent}%</p>}
            </div>
          </CardContent>
        </Card>
      )}

      {canWriteNote && (
        <Card>
          <CardHeader>
            <CardTitle>Medical Record</CardTitle>
          </CardHeader>
          <CardContent>
            <NoteForm patientId={appointment.patientId} />
          </CardContent>
        </Card>
      )}

      {(appointment.diagnoses.length > 0 || canPrescribe) && (
        <Card>
          <CardHeader>
            <CardTitle>Diagnosis</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <DiagnosisList diagnoses={appointment.diagnoses} canDelete={canPrescribe} />
            {canPrescribe && <DiagnosisForm appointmentId={appointment.id} />}
          </CardContent>
        </Card>
      )}

      {appointment.prescriptions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("writePrescription")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {appointment.prescriptions.map((rx) => (
              <div key={rx.id} className="rounded-md border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {new Date(rx.createdAt).toLocaleString()}
                  </span>
                  <Badge variant={rx.fulfilled ? "success" : "outline"}>
                    {rx.fulfilled ? "Fulfilled" : "Pending"}
                  </Badge>
                </div>
                <ul className="text-sm">
                  {rx.items.map((item) => (
                    <li key={item.id}>
                      {item.medicine.name} &mdash; {item.dosage} x{item.quantity}
                      {item.timesPerDay && item.durationDays && (
                        <span className="text-muted-foreground">
                          {" "}
                          (reminders: {item.timesPerDay}x/day for {item.durationDays} days)
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {canWriteNote && !isSameDayAsVisit && (
        <p className="text-sm text-muted-foreground">
          This visit is from a previous day, so a new prescription can no longer be written for it.
        </p>
      )}

      {canPrescribe && (
        <Card>
          <CardHeader>
            <CardTitle>{t("writePrescription")}</CardTitle>
          </CardHeader>
          <CardContent>
            <PrescriptionForm
              action={boundCreatePrescription}
              medicines={medicines.map((m) => ({
                id: m.id,
                name: m.name,
                unit: m.unit,
              }))}
            />
          </CardContent>
        </Card>
      )}

      {appointment.labOrders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Lab Orders</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {appointment.labOrders.map((order) => (
              <div key={order.id} className="rounded-md border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {new Date(order.createdAt).toLocaleString()}
                  </span>
                  <Badge variant={order.status === "COMPLETED" ? "success" : "outline"}>
                    {order.status.replace("_", " ")}
                  </Badge>
                </div>
                <ul className="text-sm">
                  {order.items.map((item) => (
                    <li key={item.id}>{item.labTest.name}</li>
                  ))}
                </ul>
                {order.status === "COMPLETED" && (
                  <Link
                    href={`/lab-report/${order.id}`}
                    className="text-sm underline text-muted-foreground"
                  >
                    View report
                  </Link>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {canPrescribe && labTests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Order Lab Tests</CardTitle>
          </CardHeader>
          <CardContent>
            <OrderLabTestsForm
              appointmentId={appointment.id}
              tests={labTests.map((test) => ({
                id: test.id,
                name: test.name,
                price: Number(test.price),
              }))}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

import { notFound } from "next/navigation";
import { Phone, Mail, CalendarDays } from "lucide-react";
import { GENDER_LABELS } from "@/lib/patients";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/authz";
import { updatePatient } from "@/actions/patients";
import { PatientForm } from "@/components/patients/patient-form";
import { MedicalRecordList } from "@/components/medical-records/medical-record-list";
import { NoteForm } from "@/components/medical-records/note-form";
import { DocumentUploadForm } from "@/components/medical-records/document-upload-form";
import { DiagnosisList } from "@/components/diagnoses/diagnosis-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { SetPasswordForm } from "@/components/staff/set-password-form";

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePageRole(["ADMIN", "DOCTOR", "RECEPTIONIST", "PHARMACIST"]);
  const { id } = await params;
  const tAppt = await getTranslations("appointments");
  const role = session.user.role;

  const patient = await prisma.patient.findUnique({
    where: { id },
    include: {
      appointments: {
        orderBy: { scheduledAt: "desc" },
        include: { doctor: { include: { user: true } } },
      },
      medicalRecords: {
        orderBy: { createdAt: "desc" },
        include: { author: true },
      },
      diagnoses: {
        orderBy: { createdAt: "desc" },
        include: { doctor: { include: { user: true } } },
      },
    },
  });

  if (!patient) notFound();

  const boundUpdate = updatePatient.bind(null, patient.id);
  const canEditPatient = role === "ADMIN" || role === "RECEPTIONIST";

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">{patient.name}</h1>

      {canEditPatient ? (
        <PatientForm
          action={boundUpdate}
          defaultValues={{
            name: patient.name,
            gender: patient.gender ?? "",
            email: patient.email ?? "",
            phone: patient.phone ?? "",
            dob: patient.dob ? patient.dob.toISOString().slice(0, 10) : "",
            address: patient.address ?? "",
            notes: patient.notes ?? "",
            allergies: patient.allergies ?? "",
            insuranceProvider: patient.insuranceProvider ?? "",
            insurancePolicyNumber: patient.insurancePolicyNumber ?? "",
            emergencyContactName: patient.emergencyContactName ?? "",
            emergencyContactPhone: patient.emergencyContactPhone ?? "",
          }}
        />
      ) : (
        <Card>
          <CardContent className="grid gap-2 text-sm text-muted-foreground">
            {patient.gender && <p>{GENDER_LABELS[patient.gender]}</p>}
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
            {patient.dob && (
              <div className="flex items-center gap-2">
                <CalendarDays className="size-4" />
                {new Date(patient.dob).toLocaleDateString()}
              </div>
            )}
            {patient.address && <p>{patient.address}</p>}
            {patient.notes && (
              <p>
                <span className="font-medium text-foreground">Medical notes:</span>{" "}
                {patient.notes}
              </p>
            )}
            {patient.allergies && (
              <p className="text-destructive">
                <span className="font-medium">Allergies:</span> {patient.allergies}
              </p>
            )}
            {(patient.insuranceProvider || patient.insurancePolicyNumber) && (
              <p>
                <span className="font-medium text-foreground">Insurance:</span>{" "}
                {[patient.insuranceProvider, patient.insurancePolicyNumber]
                  .filter(Boolean)
                  .join(" — ")}
              </p>
            )}
            {(patient.emergencyContactName || patient.emergencyContactPhone) && (
              <p>
                <span className="font-medium text-foreground">Emergency contact:</span>{" "}
                {[patient.emergencyContactName, patient.emergencyContactPhone]
                  .filter(Boolean)
                  .join(" — ")}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {role === "ADMIN" && patient.userId && (
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent>
            <SetPasswordForm userId={patient.userId} />
          </CardContent>
        </Card>
      )}

      {role !== "PHARMACIST" && (
        <Card>
          <CardHeader>
            <CardTitle>{tAppt("title")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {patient.appointments.length === 0 && (
              <EmptyState icon={CalendarDays} message={tAppt("noResults")} />
            )}
            {patient.appointments.map((appt) => (
              <div
                key={appt.id}
                className="flex items-center justify-between border-b pb-2 last:border-0"
              >
                <span>
                  {new Date(appt.scheduledAt).toLocaleString()} &mdash;{" "}
                  {appt.doctor.user.name}
                </span>
                <Badge variant="outline">{appt.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {role !== "PHARMACIST" && (
        <Card>
          <CardHeader>
            <CardTitle>Diagnosis History</CardTitle>
          </CardHeader>
          <CardContent>
            <DiagnosisList diagnoses={patient.diagnoses} showDoctor />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Medical Records</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <MedicalRecordList records={patient.medicalRecords} />
          {role === "DOCTOR" && <NoteForm patientId={patient.id} />}
          {(role === "ADMIN" || role === "RECEPTIONIST") && (
            <DocumentUploadForm patientId={patient.id} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

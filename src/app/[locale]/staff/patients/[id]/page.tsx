import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { updatePatient } from "@/actions/patients";
import { PatientForm } from "@/components/patients/patient-form";
import { MedicalRecordList } from "@/components/medical-records/medical-record-list";
import { NoteForm } from "@/components/medical-records/note-form";
import { DocumentUploadForm } from "@/components/medical-records/document-upload-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireRole(["ADMIN", "DOCTOR", "RECEPTIONIST", "PHARMACIST"]);
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
    },
  });

  if (!patient) notFound();

  const boundUpdate = updatePatient.bind(null, patient.id);
  const canEditPatient = role === "ADMIN" || role === "DOCTOR" || role === "RECEPTIONIST";

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">{patient.name}</h1>

      {canEditPatient ? (
        <PatientForm
          action={boundUpdate}
          defaultValues={{
            name: patient.name,
            email: patient.email ?? "",
            phone: patient.phone ?? "",
            dob: patient.dob ? patient.dob.toISOString().slice(0, 10) : "",
            address: patient.address ?? "",
            notes: patient.notes ?? "",
          }}
        />
      ) : (
        <Card>
          <CardContent className="grid gap-1 text-sm">
            <p>{patient.phone}</p>
            <p>{patient.email}</p>
            <p>{patient.address}</p>
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
              <p className="text-muted-foreground">{tAppt("noResults")}</p>
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

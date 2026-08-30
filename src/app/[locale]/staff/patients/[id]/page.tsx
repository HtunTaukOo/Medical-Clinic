import { notFound } from "next/navigation";
import { Phone, Mail, CalendarDays, FlaskConical } from "lucide-react";
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
import { AllergyList } from "@/components/allergies/allergy-list";
import { AllergyForm } from "@/components/allergies/allergy-form";
import { addAllergy } from "@/actions/allergies";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { SetPasswordForm } from "@/components/staff/set-password-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "@/i18n/navigation";

const LAB_STATUS_LABEL: Record<string, string> = {
  ORDERED: "Awaiting collection",
  SAMPLE_COLLECTED: "Awaiting results",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

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
      allergyRecords: { orderBy: { createdAt: "desc" } },
      labOrders: {
        orderBy: { createdAt: "desc" },
        include: { items: { include: { labTest: true } } },
      },
    },
  });

  if (!patient) notFound();

  const boundUpdate = updatePatient.bind(null, patient.id);
  const boundAddAllergy = addAllergy.bind(null, patient.id);
  const canEditPatient = role === "ADMIN" || role === "RECEPTIONIST";
  const canManageAllergies = role === "ADMIN" || role === "DOCTOR" || role === "RECEPTIONIST";
  const notes = patient.medicalRecords.filter((r) => r.type === "NOTE");
  const documents = patient.medicalRecords.filter((r) => r.type === "DOCUMENT");

  const tabs = [
    { value: "overview", label: "Overview" },
    ...(role !== "PHARMACIST"
      ? [
          { value: "history", label: "Medical History" },
          { value: "allergies", label: "Allergies" },
          { value: "visits", label: "Visits" },
          { value: "lab-results", label: "Lab Results" },
        ]
      : []),
    { value: "documents", label: "Documents" },
  ];

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">{patient.name}</h1>

      <Tabs defaultValue="overview">
        <TabsList>
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="grid gap-6">
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
                bloodType: patient.bloodType ?? "",
                nationality: patient.nationality ?? "",
                nrcNumber: patient.nrcNumber ?? "",
                heightCm: patient.heightCm?.toString() ?? "",
                weightKg: patient.weightKg?.toString() ?? "",
                insuranceProvider: patient.insuranceProvider ?? "",
                insurancePolicyNumber: patient.insurancePolicyNumber ?? "",
                insuranceGroupNumber: patient.insuranceGroupNumber ?? "",
                insuranceCoverageType: patient.insuranceCoverageType ?? "",
                insurancePolicyHolder: patient.insurancePolicyHolder ?? "",
                insuranceExpiryDate: patient.insuranceExpiryDate
                  ? patient.insuranceExpiryDate.toISOString().slice(0, 10)
                  : "",
                emergencyContactName: patient.emergencyContactName ?? "",
                emergencyContactRelationship: patient.emergencyContactRelationship ?? "",
                emergencyContactPhone: patient.emergencyContactPhone ?? "",
                emergencyContactAltPhone: patient.emergencyContactAltPhone ?? "",
                emergencyContactAddress: patient.emergencyContactAddress ?? "",
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
        </TabsContent>

        {role !== "PHARMACIST" && (
          <>
            <TabsContent value="history" className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Diagnosis History</CardTitle>
                </CardHeader>
                <CardContent>
                  <DiagnosisList diagnoses={patient.diagnoses} showDoctor />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Notes</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <MedicalRecordList records={notes} currentUserId={session.user.id} />
                  {role === "DOCTOR" && <NoteForm patientId={patient.id} />}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="allergies">
              <Card>
                <CardHeader>
                  <CardTitle>Allergies</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <AllergyList allergies={patient.allergyRecords} canDelete={canManageAllergies} />
                  {canManageAllergies && <AllergyForm action={boundAddAllergy} />}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="visits">
              <Card>
                <CardHeader>
                  <CardTitle>{tAppt("title")}</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2">
                  {patient.appointments.length === 0 && (
                    <EmptyState icon={CalendarDays} message={tAppt("noResults")} />
                  )}
                  {patient.appointments.map((appt) => (
                    <Link
                      key={appt.id}
                      href={`/staff/appointments/${appt.id}`}
                      className="flex items-center justify-between border-b pb-2 last:border-0 hover:bg-muted/50"
                    >
                      <span>
                        {new Date(appt.scheduledAt).toLocaleString()} &mdash;{" "}
                        {appt.doctor.user.name}
                      </span>
                      <Badge variant="outline">{appt.status}</Badge>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="lab-results">
              <Card>
                <CardHeader>
                  <CardTitle>Lab Results</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3">
                  {patient.labOrders.length === 0 ? (
                    <EmptyState icon={FlaskConical} message="No lab orders yet." />
                  ) : (
                    patient.labOrders.map((order) => (
                      <div key={order.id} className="rounded-md border p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">
                            {new Date(order.createdAt).toLocaleString()}
                          </span>
                          <Badge variant={order.status === "COMPLETED" ? "success" : "outline"}>
                            {LAB_STATUS_LABEL[order.status] ?? order.status}
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
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </>
        )}

        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <MedicalRecordList records={documents} currentUserId={session.user.id} />
              {(role === "ADMIN" || role === "RECEPTIONIST") && (
                <DocumentUploadForm patientId={patient.id} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

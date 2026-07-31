import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SelfProfileForm } from "@/components/patients/self-profile-form";
import { TelegramConnectCard } from "@/components/telegram/telegram-connect-card";
import { MedicalRecordList } from "@/components/medical-records/medical-record-list";
import { DocumentUploadForm } from "@/components/medical-records/document-upload-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function toDateInputValue(date: Date | null) {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

export default async function PortalSettingsPage() {
  const session = await auth();
  const t = await getTranslations();
  const patientId = session?.user.patientId;

  const patient = patientId
    ? await prisma.patient.findUnique({ where: { id: patientId } })
    : null;

  const medicalRecords = patientId
    ? await prisma.medicalRecord.findMany({
        where: { patientId },
        orderBy: { createdAt: "desc" },
        include: { author: true },
      })
    : [];

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">{t("nav.settings")}</h1>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="telegram">Telegram</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4 grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
            </CardHeader>
            <CardContent>
              {patient && (
                <SelfProfileForm
                  defaultValues={{
                    name: patient.name,
                    email: patient.email ?? "",
                    phone: patient.phone ?? "",
                    dob: toDateInputValue(patient.dob),
                    address: patient.address ?? "",
                    allergies: patient.allergies ?? "",
                    insuranceProvider: patient.insuranceProvider ?? "",
                    insurancePolicyNumber: patient.insurancePolicyNumber ?? "",
                    emergencyContactName: patient.emergencyContactName ?? "",
                    emergencyContactPhone: patient.emergencyContactPhone ?? "",
                  }}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Upload a document</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-sm text-muted-foreground">
                New to the clinic? Upload your previous medical history or records here.
              </p>
              {patientId && <DocumentUploadForm patientId={patientId} />}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("nav.medicalRecords")}</CardTitle>
            </CardHeader>
            <CardContent>
              <MedicalRecordList records={medicalRecords} currentUserId={session?.user.id} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="telegram" className="mt-4">
          <TelegramConnectCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}

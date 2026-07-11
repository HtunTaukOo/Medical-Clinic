import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { MedicalRecordList } from "@/components/medical-records/medical-record-list";
import { DocumentUploadForm } from "@/components/medical-records/document-upload-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function PortalRecordsPage() {
  const session = await auth();
  const t = await getTranslations("nav");
  const patientId = session?.user.patientId;

  const records = patientId
    ? await prisma.medicalRecord.findMany({
        where: { patientId },
        orderBy: { createdAt: "desc" },
        include: { author: true },
      })
    : [];

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">{t("medicalRecords")}</h1>
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
          <CardTitle>{t("medicalRecords")}</CardTitle>
        </CardHeader>
        <CardContent>
          <MedicalRecordList records={records} />
        </CardContent>
      </Card>
    </div>
  );
}

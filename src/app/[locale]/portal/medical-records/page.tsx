import { CalendarDays } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/empty-state";
import { MedicalRecordList } from "@/components/medical-records/medical-record-list";
import { DocumentUploadForm } from "@/components/medical-records/document-upload-form";
import { PrescriptionHistoryList } from "@/components/medical-records/prescription-history-list";
import { LabResultsTable } from "@/components/medical-records/lab-results-table";

const PILL_TAB_LIST =
  "!h-auto w-full flex-wrap justify-start gap-2 bg-transparent p-0";
const PILL_TAB_TRIGGER =
  "!h-auto flex-none grow-0 rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-foreground shadow-none data-active:border-transparent data-active:bg-primary data-active:text-primary-foreground";

export default async function PortalMedicalRecordsPage() {
  const session = await auth();
  const t = await getTranslations();
  const tp = await getTranslations("portal.medicalRecords");
  const patientId = session?.user.patientId;
  const now = new Date();

  const [visits, prescriptions, labOrders, documents] = await Promise.all([
    patientId
      ? prisma.appointment.findMany({
          where: { patientId, status: "COMPLETED" },
          orderBy: { scheduledAt: "desc" },
          include: {
            doctor: { include: { user: true } },
            diagnoses: { orderBy: { createdAt: "asc" }, take: 1 },
          },
        })
      : [],
    patientId
      ? prisma.prescription.findMany({
          where: { patientId },
          orderBy: { createdAt: "desc" },
          include: {
            doctor: { include: { user: true } },
            items: { include: { medicine: true } },
          },
        })
      : [],
    patientId
      ? prisma.labOrder.findMany({
          where: { patientId, status: "COMPLETED" },
          include: { items: { include: { labTest: true } } },
          orderBy: { completedAt: "desc" },
        })
      : [],
    patientId
      ? prisma.medicalRecord.findMany({
          where: { patientId },
          orderBy: { createdAt: "desc" },
          include: { author: true },
        })
      : [],
  ]);

  const prescriptionItems = prescriptions.flatMap((rx) =>
    rx.items.map((item) => ({
      id: item.id,
      createdAt: rx.createdAt,
      fulfilledAt: rx.fulfilledAt,
      doctor: rx.doctor,
      medicine: item.medicine,
      dosage: item.dosage,
      frequency: item.frequency,
      timesPerDay: item.timesPerDay,
      durationDays: item.durationDays,
      instructions: item.instructions,
      refillsLeft: item.refillsLeft,
    }))
  );

  const labRows = labOrders.flatMap((order) =>
    order.items.map((item) => ({
      id: item.id,
      labOrderId: order.id,
      testName: item.labTest.name,
      resultValue: item.resultValue,
      unit: item.labTest.unit,
      normalRange: item.labTest.normalRange,
      resultStatus: item.resultStatus,
      date: order.completedAt,
    }))
  );

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{t("nav.medicalRecords")}</h1>
        <p className="text-sm text-muted-foreground">{tp("description")}</p>
      </div>

      <Tabs defaultValue="visits">
        <TabsList className={PILL_TAB_LIST}>
          <TabsTrigger value="visits" className={PILL_TAB_TRIGGER}>
            {tp("tabVisitHistory")}
          </TabsTrigger>
          <TabsTrigger value="prescriptions" className={PILL_TAB_TRIGGER}>
            {tp("tabDrugsInstructions")}
          </TabsTrigger>
          <TabsTrigger value="lab-results" className={PILL_TAB_TRIGGER}>
            {t("nav.labResults")}
          </TabsTrigger>
          <TabsTrigger value="documents" className={PILL_TAB_TRIGGER}>
            {tp("tabDocuments")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="visits" className="mt-4">
          {visits.length === 0 ? (
            <EmptyState icon={CalendarDays} message={tp("noCompletedVisits")} />
          ) : (
            <div className="grid gap-3">
              {visits.map((visit) => {
                const diagnosis = visit.diagnoses[0];
                const note = diagnosis?.notes ?? visit.notes;
                return (
                  <Link key={visit.id} href={`/portal/appointments/${visit.id}`}>
                    <Card className="transition-colors hover:bg-muted/50">
                      <CardContent className="grid gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">
                            {diagnosis?.description ?? tp("visitFallback")}
                          </span>
                          <Badge className="bg-blue-100 text-blue-700">
                            {visit.doctor.specialty ?? tp("generalMedicineFallback")}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {visit.doctor.user.name} · {new Date(visit.scheduledAt).toLocaleDateString()}
                        </p>
                        {visit.reason && (
                          <p className="text-sm text-muted-foreground">
                            {tp("reasonLabel", { reason: visit.reason })}
                          </p>
                        )}
                        {note && <p className="text-sm text-muted-foreground italic">{note}</p>}
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="prescriptions" className="mt-4">
          <PrescriptionHistoryList items={prescriptionItems} now={now} />
        </TabsContent>

        <TabsContent value="lab-results" className="mt-4">
          <LabResultsTable rows={labRows} />
        </TabsContent>

        <TabsContent value="documents" className="mt-4 grid gap-6">
          <Card>
            <CardContent>
              <p className="mb-3 text-sm text-muted-foreground">{tp("uploadPrompt")}</p>
              {patientId && <DocumentUploadForm patientId={patientId} />}
            </CardContent>
          </Card>
          <MedicalRecordList records={documents} currentUserId={session?.user.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

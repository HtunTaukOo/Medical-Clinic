import { User, HeartPulse, ShieldCheck, Lock, Settings2, Send } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { initials } from "@/lib/format";
import { TelegramConnectCard } from "@/components/telegram/telegram-connect-card";
import { AllergyList } from "@/components/allergies/allergy-list";
import { AllergyForm } from "@/components/allergies/allergy-form";
import { addOwnAllergy } from "@/actions/allergies";
import { PersonalDetailsForm } from "@/components/patients/personal-details-form";
import { EmergencyContactForm } from "@/components/patients/emergency-contact-form";
import { InsuranceForm } from "@/components/patients/insurance-form";
import { ChangePasswordForm } from "@/components/security/change-password-form";
import { PrivacyToggle } from "@/components/patients/privacy-toggle";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/empty-state";

function toDateInputValue(date: Date | null) {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

const SIDEBAR_TAB_LIST =
  "h-fit w-full shrink-0 flex-col items-stretch gap-1 rounded-xl border bg-white p-2 md:w-60";
const SIDEBAR_TAB_TRIGGER =
  "justify-start gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium data-active:bg-primary data-active:text-primary-foreground";

export default async function PortalSettingsPage() {
  const session = await auth();
  const patientId = session?.user.patientId;

  const [patient, allergies] = await Promise.all([
    patientId ? prisma.patient.findUnique({ where: { id: patientId } }) : null,
    patientId
      ? prisma.allergy.findMany({ where: { patientId }, orderBy: { createdAt: "desc" } })
      : [],
  ]);

  if (!patient) {
    return <EmptyState icon={User} message="No patient profile found." />;
  }

  const memberSince = patient.createdAt.toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar className="size-16">
          <AvatarFallback className="bg-primary text-lg text-primary-foreground">
            {initials(patient.name)}
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl font-semibold">{patient.name}</h1>
          <p className="text-sm text-muted-foreground">
            Patient ID: {patient.patientCode ?? "—"}
          </p>
          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <Badge className="gap-1.5 bg-emerald-100 text-emerald-700">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              {patient.active ? "Active Patient" : "Inactive Patient"}
            </Badge>
            <span>· Member since {memberSince}</span>
          </div>
        </div>
      </div>

      <Tabs
        defaultValue="personal"
        orientation="vertical"
        className="flex-col items-stretch gap-6 md:flex-row md:items-start"
      >
        <TabsList className={SIDEBAR_TAB_LIST}>
          <TabsTrigger value="personal" className={SIDEBAR_TAB_TRIGGER}>
            <User className="size-4" />
            Personal Details
          </TabsTrigger>
          <TabsTrigger value="emergency" className={SIDEBAR_TAB_TRIGGER}>
            <HeartPulse className="size-4" />
            Emergency Contact
          </TabsTrigger>
          <TabsTrigger value="insurance" className={SIDEBAR_TAB_TRIGGER}>
            <ShieldCheck className="size-4" />
            Insurance
          </TabsTrigger>
          <TabsTrigger value="security" className={SIDEBAR_TAB_TRIGGER}>
            <Lock className="size-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="privacy" className={SIDEBAR_TAB_TRIGGER}>
            <Settings2 className="size-4" />
            Privacy
          </TabsTrigger>
          <TabsTrigger value="telegram" className={SIDEBAR_TAB_TRIGGER}>
            <Send className="size-4" />
            Telegram
          </TabsTrigger>
        </TabsList>

        <Card className="w-full flex-1">
          <CardContent>
            <TabsContent value="personal" className="grid gap-6">
              <PersonalDetailsForm
                defaultValues={{
                  name: patient.name,
                  gender: patient.gender ?? "",
                  email: patient.email ?? "",
                  phone: patient.phone ?? "",
                  dob: toDateInputValue(patient.dob),
                  address: patient.address ?? "",
                  bloodType: patient.bloodType ?? "",
                  nationality: patient.nationality ?? "",
                  nrcNumber: patient.nrcNumber ?? "",
                  heightCm: patient.heightCm?.toString() ?? "",
                  weightKg: patient.weightKg?.toString() ?? "",
                }}
              />
              <div className="grid gap-3 border-t pt-6">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Allergies
                </p>
                <AllergyList allergies={allergies} canDelete />
                <AllergyForm action={addOwnAllergy} />
              </div>
            </TabsContent>

            <TabsContent value="emergency">
              <EmergencyContactForm
                defaultValues={{
                  emergencyContactName: patient.emergencyContactName ?? "",
                  emergencyContactRelationship: patient.emergencyContactRelationship ?? "",
                  emergencyContactPhone: patient.emergencyContactPhone ?? "",
                  emergencyContactAltPhone: patient.emergencyContactAltPhone ?? "",
                  emergencyContactAddress: patient.emergencyContactAddress ?? "",
                }}
              />
            </TabsContent>

            <TabsContent value="insurance">
              <InsuranceForm
                defaultValues={{
                  insuranceProvider: patient.insuranceProvider ?? "",
                  insurancePolicyNumber: patient.insurancePolicyNumber ?? "",
                  insuranceGroupNumber: patient.insuranceGroupNumber ?? "",
                  insuranceCoverageType: patient.insuranceCoverageType ?? "",
                  insurancePolicyHolder: patient.insurancePolicyHolder ?? "",
                  insuranceExpiryDate: toDateInputValue(patient.insuranceExpiryDate),
                }}
              />
            </TabsContent>

            <TabsContent value="security">
              <ChangePasswordForm />
            </TabsContent>

            <TabsContent value="privacy" className="grid gap-6">
              <div>
                <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Notifications
                </p>
                <div className="grid divide-y">
                  <PrivacyToggle
                    field="notifyAppointmentReminders"
                    label="Appointment Reminders"
                    description="SMS & app reminders 24 hours before each visit"
                    defaultChecked={patient.notifyAppointmentReminders}
                  />
                  <PrivacyToggle
                    field="notifyLabResults"
                    label="Lab Result Alerts"
                    description="Notify me when new lab results are available"
                    defaultChecked={patient.notifyLabResults}
                  />
                  <PrivacyToggle
                    field="notifyPrescriptionRenewals"
                    label="Prescription Renewals"
                    description="Alert me 7 days before a prescription expires"
                    defaultChecked={patient.notifyPrescriptionRenewals}
                  />
                  <PrivacyToggle
                    field="notifyAnnouncements"
                    label="Clinic Announcements"
                    description="Receive news and updates from NCA Clinic"
                    defaultChecked={patient.notifyAnnouncements}
                  />
                  <PrivacyToggle
                    field="notifyPromotions"
                    label="Promotional Offers"
                    description="Special health packages and pharmacy discounts"
                    defaultChecked={patient.notifyPromotions}
                  />
                </div>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Data & Privacy
                </p>
                <div className="grid divide-y">
                  <PrivacyToggle
                    field="shareRecordsWithSpecialist"
                    label="Share Records with Specialist"
                    description="Allow referred doctors to view your medical history"
                    defaultChecked={patient.shareRecordsWithSpecialist}
                  />
                  <PrivacyToggle
                    field="allowAnalytics"
                    label="Analytics Data"
                    description="Help improve our portal by sharing anonymised usage data"
                    defaultChecked={patient.allowAnalytics}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="telegram">
              <TelegramConnectCard />
            </TabsContent>
          </CardContent>
        </Card>
      </Tabs>
    </div>
  );
}

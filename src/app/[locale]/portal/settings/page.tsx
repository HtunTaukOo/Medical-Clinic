import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SelfProfileForm } from "@/components/patients/self-profile-form";
import { TelegramConnectCard } from "@/components/telegram/telegram-connect-card";
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

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">{t("nav.settings")}</h1>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="telegram">Telegram</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4">
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
                  }}
                />
              )}
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

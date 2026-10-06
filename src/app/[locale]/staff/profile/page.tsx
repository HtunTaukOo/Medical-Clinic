import { notFound } from "next/navigation";
import { User, Lock, Bell, History } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/authz";
import { initials } from "@/lib/format";
import { StaffPersonalInfoForm } from "@/components/staff/staff-personal-info-form";
import { StaffNotificationToggle } from "@/components/staff/staff-notification-toggle";
import { ChangePasswordForm } from "@/components/security/change-password-form";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/empty-state";
import { getLocale, getTranslations } from "next-intl/server";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const SIDEBAR_TAB_LIST =
  "h-fit w-full shrink-0 flex-col items-stretch gap-1 rounded-xl border bg-white p-2 md:w-56";
const SIDEBAR_TAB_TRIGGER =
  "justify-start gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium data-active:bg-primary data-active:text-primary-foreground";

export default async function StaffProfilePage() {
  const session = await requirePageRole(["ADMIN", "STAFF"]);
  const t = await getTranslations("staffProfile");
  const locale = await getLocale();

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) notFound();

  const activity = await prisma.activityLog.findMany({
    where: { actorId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const memberSince = user.createdAt.toLocaleDateString(locale === "my" ? "my-MM" : "en-US", {
    month: "short",
    year: "numeric",
  });
  const roleDisplay = user.title
    ? `${user.title} / ${user.role === "ADMIN" ? t("administrator") : t("staff")}`
    : (user.role === "ADMIN" ? t("administrator") : t("staff"));

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar className="size-16">
          <AvatarFallback className="bg-primary text-lg text-primary-foreground">
            {initials(user.name)}
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl font-semibold">{user.name}</h1>
          <p className="text-sm text-muted-foreground">{roleDisplay}</p>
          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <Badge className="gap-1.5 bg-emerald-100 text-emerald-700">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              {user.active ? t("active") : t("inactive")}
            </Badge>
            <span>· {t("clinicSince", { date: memberSince })}</span>
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
            <User className="size-4 text-violet-500" />
            {t("personalInfo")}
          </TabsTrigger>
          <TabsTrigger value="security" className={SIDEBAR_TAB_TRIGGER}>
            <Lock className="size-4 text-amber-500" />
            {t("password")}
          </TabsTrigger>
          <TabsTrigger value="notifications" className={SIDEBAR_TAB_TRIGGER}>
            <Bell className="size-4 text-yellow-500" />
            {t("notifications")}
          </TabsTrigger>
          <TabsTrigger value="activity" className={SIDEBAR_TAB_TRIGGER}>
            <History className="size-4 text-blue-500" />
            {t("activityHistory")}
          </TabsTrigger>
        </TabsList>

        <Card className="w-full flex-1">
          <CardContent>
            <TabsContent value="personal">
              <p className="mb-4 text-lg font-semibold">{t("personalInformation")}</p>
              <StaffPersonalInfoForm
                name={user.name}
                email={user.email}
                phone={user.phone ?? ""}
                roleLabel={roleDisplay}
              />
            </TabsContent>

            <TabsContent value="security">
              <ChangePasswordForm />
            </TabsContent>

            <TabsContent value="notifications" className="grid gap-6">
              <div>
                <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {t("alerts")}
                </p>
                <div className="grid divide-y">
                  <StaffNotificationToggle
                    field="notifyNewAppointments"
                    label={t("newAppointments")}
                    description={t("newAppointmentsHelp")}
                    defaultChecked={user.notifyNewAppointments}
                  />
                  <StaffNotificationToggle
                    field="notifyLowStock"
                    label={t("inventoryAlerts")}
                    description={t("inventoryAlertsHelp")}
                    defaultChecked={user.notifyLowStock}
                  />
                  <StaffNotificationToggle
                    field="notifyAnnouncements"
                    label={t("clinicAnnouncements")}
                    description={t("clinicAnnouncementsHelp")}
                    defaultChecked={user.notifyAnnouncements}
                  />
                  <StaffNotificationToggle
                    field="notifyBilling"
                    label={t("billingAlerts")}
                    description={t("billingAlertsHelp")}
                    defaultChecked={user.notifyBilling}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="activity">
              <p className="mb-4 text-lg font-semibold">{t("activityHistory")}</p>
              {activity.length === 0 ? (
                <EmptyState icon={History} message={t("noActivity")} />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("date")}</TableHead><TableHead>{t("action")}</TableHead><TableHead>{t("target")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activity.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {new Date(entry.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell>{entry.action}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {entry.target ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </CardContent>
        </Card>
      </Tabs>
    </div>
  );
}

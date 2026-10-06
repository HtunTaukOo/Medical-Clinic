import { DatabaseBackup, Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getClinicSettings, getClinicWeeklyHours } from "@/lib/clinic-hours";
import { getAllSpecialties } from "@/lib/specialties-data";
import { getSpecialtyIcon } from "@/lib/specialties";
import { toggleSpecialtyActive } from "@/actions/specialties";
import { ClinicProfileForm } from "@/components/clinic/clinic-profile-form";
import { WeeklyHoursForm } from "@/components/clinic/weekly-hours-form";
import { ClinicNotificationsForm } from "@/components/clinic/clinic-notifications-form";
import { SpecialtyDialog } from "@/components/staff/specialty-dialog";
import { DeleteSpecialtyButton } from "@/components/staff/delete-specialty-button";
import { ActiveToggle } from "@/components/staff/active-toggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { StaffPermissionToggle } from "@/components/staff/staff-permission-toggle";
import { getStaffPermissions, STAFF_PERMISSION_KEYS } from "@/lib/permissions";

const PILL_TAB_LIST = "!h-auto w-full flex-wrap justify-start gap-2 bg-transparent p-0";
const PILL_TAB_TRIGGER =
  "!h-auto flex-none grow-0 rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-foreground shadow-none data-active:border-transparent data-active:bg-primary data-active:text-primary-foreground";

export default async function ClinicSettingsPage() {
  await requirePageRole(["ADMIN"]);
  const t = await getTranslations("settings");
  const permissionLabels = {
    VIEW_APPOINTMENTS: t("viewAppointments"),
    CREATE_APPOINTMENTS: t("createAppointments"),
    CONFIRM_RESCHEDULE_APPOINTMENTS: t("confirmRescheduleAppointments"),
    CANCEL_APPOINTMENTS: t("cancelAppointments"),
    VIEW_PATIENTS: t("viewPatients"),
    EDIT_PATIENTS: t("editPatients"),
    VIEW_BILLING: t("viewBilling"),
    MANAGE_BILLING: t("manageBilling"),
    VIEW_REPORTS: t("viewReports"),
  } as const;

  const [settings, weeklyHours, auditLog, specialties, staffPermissions] = await Promise.all([
    getClinicSettings(),
    getClinicWeeklyHours(),
    prisma.activityLog.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    getAllSpecialties(),
    getStaffPermissions(),
  ]);
  const staffPermissionByKey = new Map(staffPermissions.map((p) => [p.key, p.enabled]));

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("description")}
        </p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList className={PILL_TAB_LIST}>
          <TabsTrigger value="profile" className={PILL_TAB_TRIGGER}>
            {t("clinicProfile")}
          </TabsTrigger>
          <TabsTrigger value="hours" className={PILL_TAB_TRIGGER}>
            {t("workingHours")}
          </TabsTrigger>
          <TabsTrigger value="notifications" className={PILL_TAB_TRIGGER}>
            {t("notifications")}
          </TabsTrigger>
          <TabsTrigger value="specialties" className={PILL_TAB_TRIGGER}>
            {t("specialties")}
          </TabsTrigger>
          <TabsTrigger value="permissions" className={PILL_TAB_TRIGGER}>
            {t("staffPermissions")}
          </TabsTrigger>
          <TabsTrigger value="audit" className={PILL_TAB_TRIGGER}>
            {t("auditLog")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4">
          <Card>
            <CardContent>
              <p className="mb-4 text-lg font-semibold">{t("clinicProfile")}</p>
              <ClinicProfileForm
                name={settings.name}
                email={settings.email}
                address={settings.address}
                phones={settings.phones}
                hasLogo={!!settings.logoData}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hours" className="mt-4">
          <Card>
            <CardContent>
              <p className="mb-4 text-lg font-semibold">{t("workingHours")}</p>
              <WeeklyHoursForm days={weeklyHours} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="mt-4">
          <Card>
            <CardContent>
              <p className="mb-4 text-lg font-semibold">{t("notifications")}</p>
              <ClinicNotificationsForm staffTelegramChatId={settings.staffTelegramChatId} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="specialties" className="mt-4">
          <Card>
            <CardContent>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-lg font-semibold">{t("specialties")}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("specialtiesDescription")}
                  </p>
                </div>
                <SpecialtyDialog
                  trigger={
                    <Button size="sm">
                      <Plus className="size-4" />
                      {t("addSpecialty")}
                    </Button>
                  }
                />
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("icon")}</TableHead>
                    <TableHead>{t("name")}</TableHead>
                    <TableHead>{t("descriptionLabel")}</TableHead>
                    <TableHead>{t("booking")}</TableHead>
                    <TableHead>{t("active")}</TableHead>
                    <TableHead className="text-right">{t("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {specialties.map((s) => {
                    const Icon = getSpecialtyIcon(s.icon);
                    return (
                      <TableRow key={s.id}>
                        <TableCell>
                          <div className="flex size-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                            <Icon className="size-4" />
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {s.description ?? "—"}
                        </TableCell>
                        <TableCell>
                          {s.bookingMode === "SERVICE_CAPACITY" ? (
                            <Badge variant="outline" className="bg-violet-100 text-violet-700">
                              {t("byServiceCapacity", { count: s.capacityPerSlot })}
                            </Badge>
                          ) : s.bookingMode === "BLOCK_CAPACITY" ? (
                            <Badge variant="outline" className="bg-blue-100 text-blue-700">
                              {t("timeBlocksCapacity", { count: s.capacityPerSlot })}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-slate-100 text-slate-600">
                              {t("byDoctor")}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <ActiveToggle
                            active={s.active}
                            action={toggleSpecialtyActive.bind(null, s.id)}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-3">
                            <SpecialtyDialog
                              specialty={{
                                id: s.id,
                                name: s.name,
                                icon: s.icon,
                                description: s.description,
                                bookingMode: s.bookingMode,
                                capacityPerSlot: s.capacityPerSlot,
                              }}
                              trigger={
                                <button className="font-medium text-primary underline underline-offset-2">
                                  {t("edit")}
                                </button>
                              }
                            />
                            <DeleteSpecialtyButton specialtyId={s.id} name={s.name} />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="permissions" className="mt-4">
          <Card>
            <CardContent>
              <div className="mb-4">
                <p className="text-lg font-semibold">{t("staffPermissions")}</p>
                <p className="text-sm text-muted-foreground">
                  {t("staffPermissionsDescription")}
                </p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("permission")}</TableHead>
                    <TableHead className="text-center">{t("enabled")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {STAFF_PERMISSION_KEYS.map((key) => (
                    <TableRow key={key}>
                      <TableCell className="font-medium">{permissionLabels[key]}</TableCell>
                      <TableCell>
                        <StaffPermissionToggle
                          permKey={key}
                          defaultEnabled={staffPermissionByKey.get(key) ?? true}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <Card>
            <CardContent>
              <p className="mb-4 text-lg font-semibold">{t("auditLog")}</p>
              {auditLog.length === 0 ? (
                <EmptyState icon={DatabaseBackup} message={t("noActivity")} />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("user")}</TableHead>
                      <TableHead>{t("action")}</TableHead>
                      <TableHead>{t("timestamp")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLog.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium text-primary">
                          {entry.actorName}
                        </TableCell>
                        <TableCell>
                          {entry.action}
                          {entry.target ? ` — ${entry.target}` : ""}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(entry.createdAt).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

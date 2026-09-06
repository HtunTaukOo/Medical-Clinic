import { DatabaseBackup } from "lucide-react";
import { requirePageRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getClinicSettings, getClinicWeeklyHours } from "@/lib/clinic-hours";
import { ClinicProfileForm } from "@/components/clinic/clinic-profile-form";
import { WeeklyHoursForm } from "@/components/clinic/weekly-hours-form";
import { ClinicNotificationsForm } from "@/components/clinic/clinic-notifications-form";
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

const PILL_TAB_LIST = "!h-auto w-full flex-wrap justify-start gap-2 bg-transparent p-0";
const PILL_TAB_TRIGGER =
  "!h-auto flex-none grow-0 rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-foreground shadow-none data-active:border-transparent data-active:bg-primary data-active:text-primary-foreground";

type PermissionRow = {
  permission: string;
  doctor: boolean;
  patient: boolean;
  staff: boolean;
  admin: boolean;
};

// A read-only reference — access control is hardcoded in code
// (requirePageRole/requireRole), not stored or editable here.
const PERMISSIONS: PermissionRow[] = [
  { permission: "View Appointments", doctor: true, patient: true, staff: true, admin: true },
  { permission: "Create Appointments", doctor: false, patient: true, staff: true, admin: true },
  { permission: "Confirm / Reschedule Appointments", doctor: false, patient: false, staff: true, admin: true },
  { permission: "Cancel Appointments", doctor: false, patient: true, staff: true, admin: true },
  { permission: "View Patients", doctor: true, patient: false, staff: true, admin: true },
  { permission: "Edit Patients", doctor: true, patient: false, staff: true, admin: true },
  { permission: "View Billing", doctor: false, patient: true, staff: true, admin: true },
  { permission: "Manage Billing", doctor: false, patient: false, staff: true, admin: true },
  { permission: "View Reports", doctor: false, patient: false, staff: false, admin: true },
  { permission: "Manage Users", doctor: false, patient: false, staff: false, admin: true },
  { permission: "System Settings", doctor: false, patient: false, staff: false, admin: true },
];

function PermissionCheck({ checked }: { checked: boolean }) {
  return (
    <div className="flex justify-center">
      <input type="checkbox" checked={checked} disabled className="size-4 accent-primary" />
    </div>
  );
}

export default async function ClinicSettingsPage() {
  await requirePageRole(["ADMIN"]);

  const [settings, weeklyHours, auditLog] = await Promise.all([
    getClinicSettings(),
    getClinicWeeklyHours(),
    prisma.activityLog.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
  ]);

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage clinic configuration and preferences.
        </p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList className={PILL_TAB_LIST}>
          <TabsTrigger value="profile" className={PILL_TAB_TRIGGER}>
            Clinic Profile
          </TabsTrigger>
          <TabsTrigger value="hours" className={PILL_TAB_TRIGGER}>
            Working Hours
          </TabsTrigger>
          <TabsTrigger value="notifications" className={PILL_TAB_TRIGGER}>
            Notifications
          </TabsTrigger>
          <TabsTrigger value="permissions" className={PILL_TAB_TRIGGER}>
            Roles & Permissions
          </TabsTrigger>
          <TabsTrigger value="audit" className={PILL_TAB_TRIGGER}>
            Audit Log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4">
          <Card>
            <CardContent>
              <p className="mb-4 text-lg font-semibold">Clinic Profile</p>
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
              <p className="mb-4 text-lg font-semibold">Working Hours</p>
              <WeeklyHoursForm days={weeklyHours} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="mt-4">
          <Card>
            <CardContent>
              <p className="mb-4 text-lg font-semibold">Notifications</p>
              <ClinicNotificationsForm staffTelegramChatId={settings.staffTelegramChatId} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="permissions" className="mt-4">
          <Card>
            <CardContent>
              <div className="mb-4">
                <p className="text-lg font-semibold">Roles & Permissions</p>
                <p className="text-sm text-muted-foreground">
                  Reference only — permissions are fixed in code and can&apos;t be changed here.
                </p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Permission</TableHead>
                    <TableHead className="text-center">Doctor</TableHead>
                    <TableHead className="text-center">Patient</TableHead>
                    <TableHead className="text-center">Staff</TableHead>
                    <TableHead className="text-center">Admin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {PERMISSIONS.map((row) => (
                    <TableRow key={row.permission}>
                      <TableCell className="font-medium">{row.permission}</TableCell>
                      <TableCell>
                        <PermissionCheck checked={row.doctor} />
                      </TableCell>
                      <TableCell>
                        <PermissionCheck checked={row.patient} />
                      </TableCell>
                      <TableCell>
                        <PermissionCheck checked={row.staff} />
                      </TableCell>
                      <TableCell>
                        <PermissionCheck checked={row.admin} />
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
              <p className="mb-4 text-lg font-semibold">Audit Log</p>
              {auditLog.length === 0 ? (
                <EmptyState icon={DatabaseBackup} message="No activity recorded yet." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Timestamp</TableHead>
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

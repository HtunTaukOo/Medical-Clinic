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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Administrator",
  STAFF: "Staff",
};

const SIDEBAR_TAB_LIST =
  "h-fit w-full shrink-0 flex-col items-stretch gap-1 rounded-xl border bg-white p-2 md:w-56";
const SIDEBAR_TAB_TRIGGER =
  "justify-start gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium data-active:bg-primary data-active:text-primary-foreground";

export default async function StaffProfilePage() {
  const session = await requirePageRole(["ADMIN", "STAFF"]);

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) notFound();

  const activity = await prisma.activityLog.findMany({
    where: { actorId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const memberSince = user.createdAt.toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
  const roleDisplay = user.title
    ? `${user.title} / ${ROLE_LABEL[user.role] ?? user.role}`
    : (ROLE_LABEL[user.role] ?? user.role);

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
              {user.active ? "Active" : "Inactive"}
            </Badge>
            <span>· NCA Clinic since {memberSince}</span>
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
            Personal Info
          </TabsTrigger>
          <TabsTrigger value="security" className={SIDEBAR_TAB_TRIGGER}>
            <Lock className="size-4 text-amber-500" />
            Password
          </TabsTrigger>
          <TabsTrigger value="notifications" className={SIDEBAR_TAB_TRIGGER}>
            <Bell className="size-4 text-yellow-500" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="activity" className={SIDEBAR_TAB_TRIGGER}>
            <History className="size-4 text-blue-500" />
            Activity History
          </TabsTrigger>
        </TabsList>

        <Card className="w-full flex-1">
          <CardContent>
            <TabsContent value="personal">
              <p className="mb-4 text-lg font-semibold">Personal Information</p>
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
                  Alerts
                </p>
                <div className="grid divide-y">
                  <StaffNotificationToggle
                    field="notifyNewAppointments"
                    label="New Appointments"
                    description="Alert when a new appointment is booked or checked in"
                    defaultChecked={user.notifyNewAppointments}
                  />
                  <StaffNotificationToggle
                    field="notifyLowStock"
                    label="Low Stock Alerts"
                    description="Alert when a medicine falls below its reorder level"
                    defaultChecked={user.notifyLowStock}
                  />
                  <StaffNotificationToggle
                    field="notifyAnnouncements"
                    label="Clinic Announcements"
                    description="Receive clinic-wide notices and updates"
                    defaultChecked={user.notifyAnnouncements}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="activity">
              <p className="mb-4 text-lg font-semibold">Activity History</p>
              {activity.length === 0 ? (
                <EmptyState icon={History} message="No activity recorded yet." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Target</TableHead>
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

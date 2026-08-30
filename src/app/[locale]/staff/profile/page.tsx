import { notFound } from "next/navigation";
import { User, GraduationCap, Lock, Bell } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/authz";
import { initials } from "@/lib/format";
import { DoctorPersonalInfoForm } from "@/components/staff/doctor-personal-info-form";
import { DoctorSpecialtyForm } from "@/components/staff/doctor-specialty-form";
import { DoctorNotificationToggle } from "@/components/staff/doctor-notification-toggle";
import { ChangePasswordForm } from "@/components/security/change-password-form";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const SIDEBAR_TAB_LIST =
  "h-fit w-full shrink-0 flex-col items-stretch gap-1 rounded-xl border bg-white p-2 md:w-60";
const SIDEBAR_TAB_TRIGGER =
  "justify-start gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium data-active:bg-primary data-active:text-primary-foreground";

export default async function DoctorProfilePage() {
  const session = await requirePageRole(["DOCTOR"]);
  const doctorId = session.user.doctorId;
  if (!doctorId) notFound();

  const doctor = await prisma.doctorProfile.findUnique({
    where: { id: doctorId },
    include: { user: true },
  });
  if (!doctor) notFound();

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar className="size-16">
          <AvatarFallback className="bg-primary text-lg text-primary-foreground">
            {initials(doctor.user.name)}
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl font-semibold">{doctor.user.name}</h1>
          <p className="text-sm text-muted-foreground">
            {doctor.specialty || "General practice"}
          </p>
        </div>
      </div>

      <Tabs defaultValue="personal" orientation="vertical" className="items-start gap-6">
        <TabsList className={SIDEBAR_TAB_LIST}>
          <TabsTrigger value="personal" className={SIDEBAR_TAB_TRIGGER}>
            <User className="size-4" />
            Personal Information
          </TabsTrigger>
          <TabsTrigger value="specialty" className={SIDEBAR_TAB_TRIGGER}>
            <GraduationCap className="size-4" />
            Specialty &amp; Qualifications
          </TabsTrigger>
          <TabsTrigger value="security" className={SIDEBAR_TAB_TRIGGER}>
            <Lock className="size-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="notifications" className={SIDEBAR_TAB_TRIGGER}>
            <Bell className="size-4" />
            Notifications
          </TabsTrigger>
        </TabsList>

        <Card className="w-full flex-1">
          <CardContent>
            <TabsContent value="personal">
              <DoctorPersonalInfoForm name={doctor.user.name} email={doctor.user.email} />
            </TabsContent>

            <TabsContent value="specialty">
              <DoctorSpecialtyForm
                specialty={doctor.specialty ?? ""}
                qualifications={doctor.qualifications ?? ""}
                experienceYears={doctor.experienceYears?.toString() ?? ""}
              />
            </TabsContent>

            <TabsContent value="security">
              <ChangePasswordForm />
            </TabsContent>

            <TabsContent value="notifications" className="grid divide-y">
              <DoctorNotificationToggle
                field="notifyNewAppointments"
                label="New Appointments"
                description="Notify me when a patient books or requests an appointment"
                defaultChecked={doctor.notifyNewAppointments}
              />
              <DoctorNotificationToggle
                field="notifyLabResults"
                label="Lab Results"
                description="Notify me when lab results are ready for my patients"
                defaultChecked={doctor.notifyLabResults}
              />
              <DoctorNotificationToggle
                field="notifyAnnouncements"
                label="Clinic Announcements"
                description="Receive news and updates from NCA Clinic"
                defaultChecked={doctor.notifyAnnouncements}
              />
            </TabsContent>
          </CardContent>
        </Card>
      </Tabs>
    </div>
  );
}

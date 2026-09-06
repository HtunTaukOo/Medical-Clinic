import { notFound } from "next/navigation";
import { User, GraduationCap, Lock, Bell } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/authz";
import { initials } from "@/lib/format";
import { getClinicSettings, formatTime } from "@/lib/clinic-hours";
import { WEEKDAY_LABELS } from "@/lib/doctor-availability";
import { DoctorPersonalInfoForm } from "@/components/staff/doctor-personal-info-form";
import { DoctorSpecialtyForm } from "@/components/staff/doctor-specialty-form";
import { DoctorNotificationToggle } from "@/components/staff/doctor-notification-toggle";
import { ChangePasswordForm } from "@/components/security/change-password-form";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const SIDEBAR_TAB_LIST =
  "h-fit w-full shrink-0 flex-col items-stretch gap-1 rounded-xl border bg-white p-2 md:w-56";
const SIDEBAR_TAB_TRIGGER =
  "justify-start gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium data-active:bg-primary data-active:text-primary-foreground";

function formatWorkingDaysRange(workingDays: number[]) {
  if (workingDays.length === 0) return "No working days set";
  const sorted = [...workingDays].sort((a, b) => a - b);
  const isContiguous = sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1);
  if (isContiguous) {
    return sorted.length === 1
      ? WEEKDAY_LABELS[sorted[0]]
      : `${WEEKDAY_LABELS[sorted[0]]}-${WEEKDAY_LABELS[sorted[sorted.length - 1]]}`;
  }
  return sorted.map((d) => WEEKDAY_LABELS[d]).join(", ");
}

export default async function DoctorProfilePage() {
  const session = await requirePageRole(["DOCTOR"]);
  const doctorId = session.user.doctorId;
  if (!doctorId) notFound();

  const [doctor, settings] = await Promise.all([
    prisma.doctorProfile.findUnique({ where: { id: doctorId }, include: { user: true } }),
    getClinicSettings(),
  ]);
  if (!doctor) notFound();

  const consultationHours = `${formatTime(
    doctor.workStartTime ?? settings.openingTime
  )} – ${formatTime(doctor.workEndTime ?? settings.closingTime)} (${formatWorkingDaysRange(
    doctor.workingDays
  )})`;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex size-20 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-blue-400 text-2xl font-bold text-white">
          {initials(doctor.user.name)}
        </div>
        <div>
          <h1 className="text-2xl font-semibold">{doctor.user.name}</h1>
          <p className="text-muted-foreground">
            {doctor.specialty || "General practice"}
            {doctor.medicalLicenseNo && ` · License: ${doctor.medicalLicenseNo}`}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm">
            <span className="flex items-center gap-1.5 font-medium text-blue-600">
              <span className="size-1.5 rounded-full bg-blue-600" />
              {doctor.user.active ? "Active Physician" : "Inactive"}
            </span>
            <span className="text-muted-foreground">
              · NCA Clinic since {doctor.createdAt.getFullYear()}
            </span>
          </p>
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
          <TabsTrigger value="professional" className={SIDEBAR_TAB_TRIGGER}>
            <GraduationCap className="size-4 text-blue-500" />
            Professional
          </TabsTrigger>
          <TabsTrigger value="security" className={SIDEBAR_TAB_TRIGGER}>
            <Lock className="size-4 text-amber-500" />
            Security
          </TabsTrigger>
          <TabsTrigger value="notifications" className={SIDEBAR_TAB_TRIGGER}>
            <Bell className="size-4 text-yellow-500" />
            Notifications
          </TabsTrigger>
        </TabsList>

        <Card className="w-full flex-1">
          <CardContent>
            <TabsContent value="personal">
              <p className="mb-4 text-lg font-semibold">Personal Information</p>
              <DoctorPersonalInfoForm
                name={doctor.user.name}
                email={doctor.user.email}
                dob={doctor.dob ? doctor.dob.toISOString().slice(0, 10) : ""}
                gender={doctor.gender ?? ""}
                phone={doctor.phone ?? ""}
                address={doctor.address ?? ""}
                nrcNumber={doctor.nrcNumber ?? ""}
                emergencyContact={doctor.emergencyContact ?? ""}
              />
            </TabsContent>

            <TabsContent value="professional">
              <p className="mb-4 text-lg font-semibold">Professional Details</p>
              <DoctorSpecialtyForm
                specialty={doctor.specialty ?? ""}
                qualifications={doctor.qualifications ?? ""}
                medicalLicenseNo={doctor.medicalLicenseNo ?? ""}
                mbbsUniversity={doctor.mbbsUniversity ?? ""}
                graduationYear={doctor.graduationYear?.toString() ?? ""}
                languages={doctor.languages}
                professionalBio={doctor.professionalBio ?? ""}
                clinicRoom={doctor.clinicRoom ?? ""}
                consultationHours={consultationHours}
              />
            </TabsContent>

            <TabsContent value="security">
              <ChangePasswordForm />
            </TabsContent>

            <TabsContent value="notifications" className="grid gap-6">
              <div>
                <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Patient Alerts
                </p>
                <div className="grid divide-y">
                  <DoctorNotificationToggle
                    field="notifyNewAppointments"
                    label="New Appointment Booked"
                    description="Alert when a patient books with you"
                    defaultChecked={doctor.notifyNewAppointments}
                  />
                  <DoctorNotificationToggle
                    field="notifyAppointmentCancelled"
                    label="Appointment Cancelled"
                    description="Alert when a patient cancels"
                    defaultChecked={doctor.notifyAppointmentCancelled}
                  />
                  <DoctorNotificationToggle
                    field="notifyPatientWaiting"
                    label="Patient Waiting"
                    description="Ping when a patient enters the waiting room"
                    defaultChecked={doctor.notifyPatientWaiting}
                  />
                  <DoctorNotificationToggle
                    field="notifyLabResults"
                    label="Lab Results Available"
                    description="Alert when lab results are ready to review"
                    defaultChecked={doctor.notifyLabResults}
                  />
                </div>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  System
                </p>
                <div className="grid divide-y">
                  <DoctorNotificationToggle
                    field="notifyAnnouncements"
                    label="Clinic Announcements"
                    description="Receive clinic-wide notices and updates"
                    defaultChecked={doctor.notifyAnnouncements}
                  />
                  <DoctorNotificationToggle
                    field="notifyScheduleReminders"
                    label="Schedule Reminders"
                    description="Daily summary of upcoming appointments"
                    defaultChecked={doctor.notifyScheduleReminders}
                  />
                  <DoctorNotificationToggle
                    field="notifyLeaveRequestStatus"
                    label="Leave Request Status"
                    description="Updates on submitted leave requests"
                    defaultChecked={doctor.notifyLeaveRequestStatus}
                  />
                </div>
              </div>
            </TabsContent>
          </CardContent>
        </Card>
      </Tabs>
    </div>
  );
}

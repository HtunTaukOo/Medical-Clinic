import { UserCog, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/authz";
import { toggleStaffActive } from "@/actions/staff";
import { togglePatientActive } from "@/actions/patients";
import { getActiveSpecialties } from "@/lib/specialties-data";
import { initials } from "@/lib/format";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { TabTransitionScope, TabButton, TabTransitionContent } from "@/components/tab-transition";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { SearchInput } from "@/components/search-input";
import { ActiveToggle } from "@/components/staff/active-toggle";
import { UserActionDialog } from "@/components/staff/user-action-dialog";
import { DoctorAccountForm } from "@/components/staff/doctor-account-form";
import { StaffAccountForm } from "@/components/staff/staff-account-form";
import { SetPasswordForm } from "@/components/staff/set-password-form";
import { DeleteUserButton } from "@/components/staff/delete-user-button";
import { DeletePatientButton } from "@/components/staff/delete-patient-button";

type RowType = "PATIENT" | "DOCTOR" | "STAFF" | "ADMIN";

type UserRow = {
  key: string;
  type: RowType;
  name: string;
  email: string;
  phone: string | null;
  specialty: string | null;
  active: boolean;
  joinedAt: Date;
  patientId?: string;
  userId?: string;
  doctorProfileId?: string;
  doctorFee?: number;
  doctorExperienceYears?: number | null;
  doctorQualifications?: string | null;
  staffTitle?: string | null;
};

const ROLE_BADGE_CLASS: Record<RowType, string> = {
  PATIENT: "bg-blue-100 text-blue-700",
  DOCTOR: "bg-emerald-100 text-emerald-700",
  STAFF: "bg-amber-100 text-amber-700",
  ADMIN: "bg-violet-100 text-violet-700",
};

const ROLE_LABEL: Record<RowType, string> = {
  PATIENT: "Patient",
  DOCTOR: "Doctor",
  STAFF: "Staff",
  ADMIN: "Admin",
};

const TABS = [
  { value: "all", label: "All" },
  { value: "patients", label: "Patients" },
  { value: "doctors", label: "Doctors" },
  { value: "staff", label: "Staff" },
  { value: "admins", label: "Admins" },
] as const;
type Tab = (typeof TABS)[number]["value"];

export default async function UserManagementPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string }>;
}) {
  const session = await requirePageRole(["ADMIN"]);
  const { tab: tabParam, q } = await searchParams;
  const tab: Tab = TABS.some(({ value }) => value === tabParam) ? (tabParam as Tab) : "all";

  const [patients, allDoctors, staffAndAdmins, specialties, serviceSpecialties] = await Promise.all([
    prisma.patient.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.doctorProfile.findMany({ include: { user: true }, orderBy: { createdAt: "desc" } }),
    prisma.user.findMany({
      where: { role: { in: ["ADMIN", "STAFF"] } },
      orderBy: { createdAt: "desc" },
    }),
    getActiveSpecialties(),
    prisma.specialty.findMany({ where: { bookingMode: "SERVICE_CAPACITY" }, select: { name: true } }),
  ]);
  const specialtyOptions = specialties.map((s) => ({ name: s.name }));

  // SERVICE_CAPACITY specialties (e.g. Lab Visit) are backed by a placeholder
  // DoctorProfile that exists only as a foreign-key target for appointments —
  // not a real staff member, so it's excluded from user management.
  const serviceSpecialtyNames = new Set(serviceSpecialties.map((s) => s.name));
  const doctors = allDoctors.filter((d) => !d.specialty || !serviceSpecialtyNames.has(d.specialty));

  const rows: UserRow[] = [
    ...patients.map((p): UserRow => ({
      key: `patient-${p.id}`,
      type: "PATIENT",
      name: p.name,
      email: p.email ?? "—",
      phone: p.phone,
      specialty: null,
      active: p.active,
      joinedAt: p.createdAt,
      patientId: p.id,
      userId: p.userId ?? undefined,
    })),
    ...doctors.map((d): UserRow => ({
      key: `doctor-${d.id}`,
      type: "DOCTOR",
      name: d.user.name,
      email: d.user.email,
      phone: d.phone ?? d.user.phone,
      specialty: d.specialty,
      active: d.user.active,
      joinedAt: d.user.createdAt,
      userId: d.user.id,
      doctorProfileId: d.id,
      doctorFee: Number(d.consultationFee),
      doctorExperienceYears: d.experienceYears,
      doctorQualifications: d.qualifications,
    })),
    ...staffAndAdmins.map((u): UserRow => ({
      key: `user-${u.id}`,
      type: u.role as "STAFF" | "ADMIN",
      name: u.name,
      email: u.email,
      phone: u.phone,
      specialty: null,
      active: u.active,
      joinedAt: u.createdAt,
      userId: u.id,
      staffTitle: u.title,
    })),
  ].sort((a, b) => b.joinedAt.getTime() - a.joinedAt.getTime());

  const byTab: Record<Tab, UserRow[]> = {
    all: rows,
    patients: rows.filter((r) => r.type === "PATIENT"),
    doctors: rows.filter((r) => r.type === "DOCTOR"),
    staff: rows.filter((r) => r.type === "STAFF"),
    admins: rows.filter((r) => r.type === "ADMIN"),
  };

  let visibleRows = byTab[tab];
  if (q) {
    const query = q.toLowerCase();
    visibleRows = visibleRows.filter(
      (r) => r.name.toLowerCase().includes(query) || r.email.toLowerCase().includes(query)
    );
  }

  return (
    <TabTransitionScope>
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">User Management</h1>
          <p className="text-sm text-muted-foreground">Manage all clinic users.</p>
        </div>
        <Button asChild>
          <Link href="/staff/users/new">
            <Plus className="size-4" />
            Add User
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {TABS.map(({ value, label }) => (
            <TabButton key={value} href={`/staff/users?tab=${value}`} active={tab === value} size="sm">
              {label}
            </TabButton>
          ))}
        </div>
        <div className="w-64 sm:w-80">
          <SearchInput placeholder="Search name, email..." />
        </div>
      </div>

      <TabTransitionContent>
      {visibleRows.length === 0 ? (
        <EmptyState icon={UserCog} message="No users match this view." />
      ) : (
        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Specialty</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="size-8">
                          <AvatarFallback className="bg-secondary text-xs text-secondary-foreground">
                            {initials(row.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{row.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={ROLE_BADGE_CLASS[row.type]}>
                        {ROLE_LABEL[row.type]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{row.email}</TableCell>
                    <TableCell className="text-muted-foreground">{row.phone ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{row.specialty ?? "—"}</TableCell>
                    <TableCell>
                      <ActiveToggle
                        active={row.active}
                        action={
                          row.type === "PATIENT"
                            ? togglePatientActive.bind(null, row.patientId!)
                            : toggleStaffActive.bind(null, row.userId!)
                        }
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.joinedAt.toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-3">
                        {row.type === "PATIENT" && (
                          <Link
                            href={`/staff/patients/${row.patientId}`}
                            className="font-medium text-primary underline underline-offset-2"
                          >
                            Edit
                          </Link>
                        )}
                        {row.type === "DOCTOR" && (
                          <UserActionDialog
                            title={`Edit ${row.name}`}
                            contentClassName="sm:max-w-lg"
                            trigger={
                              <button
                                type="button"
                                className="font-medium text-primary underline underline-offset-2"
                              >
                                Edit
                              </button>
                            }
                          >
                            <DoctorAccountForm
                              doctorId={row.doctorProfileId!}
                              currentName={row.name}
                              currentEmail={row.email}
                              currentPhone={row.phone}
                              currentSpecialty={row.specialty}
                              currentFee={row.doctorFee ?? 0}
                              currentExperienceYears={row.doctorExperienceYears}
                              currentQualifications={row.doctorQualifications}
                              specialties={specialtyOptions}
                            />
                            <Link
                              href={`/staff/users/${row.doctorProfileId}/availability`}
                              className="text-sm text-primary underline underline-offset-2"
                            >
                              Manage availability
                            </Link>
                          </UserActionDialog>
                        )}
                        {(row.type === "STAFF" || row.type === "ADMIN") && (
                          <UserActionDialog
                            title={`Edit ${row.name}`}
                            contentClassName="sm:max-w-md"
                            trigger={
                              <button
                                type="button"
                                className="font-medium text-primary underline underline-offset-2"
                              >
                                Edit
                              </button>
                            }
                          >
                            <StaffAccountForm
                              userId={row.userId!}
                              currentName={row.name}
                              currentEmail={row.email}
                              currentPhone={row.phone}
                              currentTitle={row.staffTitle}
                              showTitle={row.type === "STAFF"}
                            />
                          </UserActionDialog>
                        )}

                        {row.userId && (
                          <UserActionDialog
                            title={`Reset password — ${row.name}`}
                            trigger={
                              <button
                                type="button"
                                className="font-medium text-primary underline underline-offset-2"
                              >
                                Reset PW
                              </button>
                            }
                          >
                            <SetPasswordForm userId={row.userId} />
                          </UserActionDialog>
                        )}
                        {(row.type === "STAFF" || row.type === "ADMIN" || row.type === "DOCTOR") &&
                          row.userId !== session.user.id && (
                            <DeleteUserButton userId={row.userId!} name={row.name} />
                          )}
                        {row.type === "PATIENT" && (
                          <DeletePatientButton patientId={row.patientId!} name={row.name} />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      </TabTransitionContent>
    </div>
    </TabTransitionScope>
  );
}

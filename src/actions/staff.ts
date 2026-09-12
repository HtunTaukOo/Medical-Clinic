"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, requireSession, STAFF_ROLES, UnauthorizedError } from "@/lib/authz";
import { logActivity } from "@/lib/audit";
import { parseDateOnlyInput } from "@/lib/doctor-availability";
import { STAFF_TITLES } from "@/lib/staff-titles";
import { getActiveSpecialties } from "@/lib/specialties-data";

async function assertCanManageDoctorLeave(doctorId: string) {
  const session = await requireSession();
  if (session.user.role === "ADMIN") return;
  if (session.user.role === "DOCTOR" && session.user.doctorId === doctorId) return;
  throw new UnauthorizedError("Not allowed to manage this doctor's leave days");
}

async function validateSpecialty(specialty: string | undefined) {
  if (!specialty) return null;
  const specialties = await getActiveSpecialties();
  if (!specialties.some((s) => s.name === specialty)) {
    return "Invalid specialty";
  }
  return null;
}

const staffSchema = z.object({
  name: z.string().min(1),
  email: z.email(),
  password: z.string().min(8),
  role: z.enum(["ADMIN", "DOCTOR", "STAFF"]),
  title: z.enum(STAFF_TITLES).optional(),
  specialty: z.string().optional(),
  consultationFee: z.coerce.number().nonnegative().optional(),
});

export type StaffFormState = { error?: string; success?: boolean };

export async function createStaff(
  _prevState: StaffFormState,
  formData: FormData
): Promise<StaffFormState> {
  await requireRole(["ADMIN"]);

  const parsed = staffSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
    title: formData.get("title") || undefined,
    specialty: formData.get("specialty") || undefined,
    consultationFee: formData.get("consultationFee") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const specialtyError = await validateSpecialty(parsed.data.specialty);
  if (specialtyError) return { error: specialtyError };

  const { name, email, password, role, title, specialty, consultationFee } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    return { error: "An account with this email already exists" };
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: {
      name,
      email: email.toLowerCase(),
      passwordHash,
      role,
      title: role === "STAFF" ? title : undefined,
      doctorProfile:
        role === "DOCTOR" ? { create: { specialty, consultationFee } } : undefined,
    },
  });

  revalidatePath("/staff/users");
  return { success: true };
}

const adminDoctorAccountSchema = z.object({
  name: z.string().min(1),
  email: z.email(),
  phone: z.string().optional(),
  specialty: z.string().optional(),
  consultationFee: z.coerce.number().nonnegative(),
  experienceYears: z.coerce.number().int().nonnegative().optional(),
  qualifications: z.string().optional(),
});

export type AdminUpdateDoctorAccountState = { error?: string; success?: boolean };

// The admin-facing counterpart to updateOwnDoctorProfile/updateOwnPersonalInfo
// above — those are gated to the doctor editing themselves, so User Management
// needs its own action to let an admin edit a doctor's account on their behalf.
export async function adminUpdateDoctorAccount(
  doctorId: string,
  _prevState: AdminUpdateDoctorAccountState,
  formData: FormData
): Promise<AdminUpdateDoctorAccountState> {
  await requireRole(["ADMIN"]);

  const parsed = adminDoctorAccountSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") || undefined,
    specialty: formData.get("specialty") || undefined,
    consultationFee: formData.get("consultationFee"),
    experienceYears: formData.get("experienceYears") || undefined,
    qualifications: formData.get("qualifications") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const specialtyError = await validateSpecialty(parsed.data.specialty);
  if (specialtyError) return { error: specialtyError };

  const doctor = await prisma.doctorProfile.findUniqueOrThrow({ where: { id: doctorId } });
  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.id !== doctor.userId) {
    return { error: "An account with this email already exists" };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: doctor.userId },
      data: { name: parsed.data.name, email },
    }),
    prisma.doctorProfile.update({
      where: { id: doctorId },
      data: {
        phone: parsed.data.phone || null,
        specialty: parsed.data.specialty || null,
        consultationFee: parsed.data.consultationFee,
        experienceYears: parsed.data.experienceYears ?? null,
        qualifications: parsed.data.qualifications ?? null,
      },
    }),
  ]);

  revalidatePath("/staff/users");
  revalidatePath("/staff/doctors");
  return { success: true };
}

export type DoctorAvailabilityFormState = { error?: string; success?: boolean };

export async function updateDoctorAvailability(
  doctorId: string,
  _prevState: DoctorAvailabilityFormState,
  formData: FormData
): Promise<DoctorAvailabilityFormState> {
  await requireRole(["ADMIN"]);

  const workingDays = formData.getAll("workingDays").map(Number);
  const workStartTime = (formData.get("workStartTime") as string) || null;
  const workEndTime = (formData.get("workEndTime") as string) || null;

  if (workingDays.length === 0) {
    return { error: "Select at least one working day" };
  }
  if ((workStartTime && !workEndTime) || (!workStartTime && workEndTime)) {
    return { error: "Set both a start and end time, or leave both blank to use the clinic's default hours" };
  }
  if (workStartTime && workEndTime && workStartTime >= workEndTime) {
    return { error: "Start time must be before end time" };
  }

  await prisma.doctorProfile.update({
    where: { id: doctorId },
    data: { workingDays, workStartTime, workEndTime },
  });

  revalidatePath(`/staff/users/${doctorId}/availability`);
  return { success: true };
}

const leaveSchema = z.object({
  date: z.string().min(1),
  reason: z.string().optional(),
});

export type DoctorLeaveFormState = { error?: string; success?: boolean };

export async function addDoctorLeave(
  doctorId: string,
  _prevState: DoctorLeaveFormState,
  formData: FormData
): Promise<DoctorLeaveFormState> {
  await assertCanManageDoctorLeave(doctorId);

  const parsed = leaveSchema.safeParse({
    date: formData.get("date"),
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const date = parseDateOnlyInput(parsed.data.date);
  await prisma.doctorLeave.upsert({
    where: { doctorId_date: { doctorId, date } },
    update: { reason: parsed.data.reason },
    create: { doctorId, date, reason: parsed.data.reason },
  });

  revalidatePath(`/staff/users/${doctorId}/availability`);
  revalidatePath("/doctor/schedule");
  return { success: true };
}

export async function removeDoctorLeave(leaveId: string) {
  const leave = await prisma.doctorLeave.findUniqueOrThrow({ where: { id: leaveId } });
  await assertCanManageDoctorLeave(leave.doctorId);

  await prisma.doctorLeave.delete({ where: { id: leaveId } });
  revalidatePath(`/staff/users/${leave.doctorId}/availability`);
  revalidatePath("/doctor/schedule");
}

const setPasswordSchema = z.object({
  password: z.string().min(8),
});

export type SetPasswordFormState = { error?: string; success?: boolean };

export async function adminSetPassword(
  userId: string,
  _prevState: SetPasswordFormState,
  formData: FormData
): Promise<SetPasswordFormState> {
  const session = await requireRole(["ADMIN"]);

  const parsed = setPasswordSchema.safeParse({
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const target = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, resetToken: null, resetTokenExpiresAt: null },
  });

  await logActivity({
    actorId: session.user.id,
    actorName: session.user.name ?? session.user.email ?? "Unknown",
    actorRole: session.user.role,
    action: "Set a new password",
    target: `${target.name} (${target.email})`,
  });

  revalidatePath("/staff/users");
  return { success: true };
}

export async function toggleStaffActive(userId: string) {
  const session = await requireRole(["ADMIN"]);

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  await prisma.user.update({
    where: { id: userId },
    data: { active: !user.active },
  });

  await logActivity({
    actorId: session.user.id,
    actorName: session.user.name ?? session.user.email ?? "Unknown",
    actorRole: session.user.role,
    action: user.active ? "Deactivated staff account" : "Activated staff account",
    target: `${user.name} (${user.email})`,
  });

  revalidatePath("/staff/users");
}

export type DeleteStaffUserState = { error?: string; success?: boolean };

// Scoped to Admin/Staff accounts only: a Doctor's User row cascades to delete
// their DoctorProfile (and from there every appointment, prescription, lab
// order, and diagnosis they ever had), and a Patient's account is the
// clinical record itself — neither is safe as a one-click delete. Deactivate
// covers both of those cases already. For Admin/Staff, still block deletion
// if they've authored anything (medical records, announcements, purchase
// orders, sales, expenses), since those rows would otherwise be silently
// orphaned or blocked by a raw FK error.
/* eslint-disable @typescript-eslint/no-unused-vars -- signature must match useActionState's (state, formData) */
export async function deleteStaffUser(
  userId: string,
  _prevState: DeleteStaffUserState,
  _formData: FormData
): Promise<DeleteStaffUserState> {
  /* eslint-enable @typescript-eslint/no-unused-vars */
  const session = await requireRole(["ADMIN"]);

  if (session.user.id === userId) {
    return { error: "You can't delete your own account." };
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.role !== "ADMIN" && user.role !== "STAFF") {
    return {
      error: "Doctor and Patient accounts can't be deleted here — deactivate them instead to keep their appointment and medical history intact.",
    };
  }

  const [medicalRecordCount, announcementCount, purchaseOrderCount, saleCount, expenseCount] =
    await Promise.all([
      prisma.medicalRecord.count({ where: { authorId: userId } }),
      prisma.announcement.count({ where: { authorId: userId } }),
      prisma.purchaseOrder.count({ where: { createdById: userId } }),
      prisma.pharmacySale.count({ where: { soldById: userId } }),
      prisma.expense.count({ where: { recordedById: userId } }),
    ]);
  const historyCount =
    medicalRecordCount + announcementCount + purchaseOrderCount + saleCount + expenseCount;
  if (historyCount > 0) {
    return {
      error: `Can't delete — ${user.name} has ${historyCount} recorded action${historyCount === 1 ? "" : "s"} in the system (records, announcements, orders, sales, or expenses). Deactivate the account instead.`,
    };
  }

  await prisma.user.delete({ where: { id: userId } });

  await logActivity({
    actorId: session.user.id,
    actorName: session.user.name ?? session.user.email ?? "Unknown",
    actorRole: session.user.role,
    action: "Deleted staff account",
    target: `${user.name} (${user.email})`,
  });

  revalidatePath("/staff/users");
  return { success: true };
}

const adminStaffAccountSchema = z.object({
  name: z.string().min(1),
  email: z.email(),
  phone: z.string().optional(),
  title: z.enum(STAFF_TITLES).optional(),
});

export type AdminUpdateStaffAccountState = { error?: string; success?: boolean };

// Admin-facing edit for Staff and Admin accounts in User Management. Title
// only applies to Staff — silently ignored for Admin rows, same as before.
export async function adminUpdateStaffAccount(
  userId: string,
  _prevState: AdminUpdateStaffAccountState,
  formData: FormData
): Promise<AdminUpdateStaffAccountState> {
  await requireRole(["ADMIN"]);

  const parsed = adminStaffAccountSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") || undefined,
    title: formData.get("title") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.id !== userId) {
    return { error: "An account with this email already exists" };
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      name: parsed.data.name,
      email,
      phone: parsed.data.phone || null,
      title: user.role === "STAFF" ? (parsed.data.title ?? null) : undefined,
    },
  });

  revalidatePath("/staff/users");
  return { success: true };
}

const ownPersonalInfoSchema = z.object({
  name: z.string().min(1),
  dob: z.string().optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  nrcNumber: z.string().optional(),
  emergencyContact: z.string().optional(),
});

export type UpdateOwnPersonalInfoState = { error?: string; success?: boolean };

export async function updateOwnPersonalInfo(
  _prevState: UpdateOwnPersonalInfoState,
  formData: FormData
): Promise<UpdateOwnPersonalInfoState> {
  const session = await requireRole(["DOCTOR"]);
  const doctorId = session.user.doctorId;
  if (!doctorId) throw new UnauthorizedError("No doctor profile");

  const parsed = ownPersonalInfoSchema.safeParse({
    name: formData.get("name"),
    dob: formData.get("dob") || undefined,
    gender: formData.get("gender") || undefined,
    phone: formData.get("phone") || undefined,
    address: formData.get("address") || undefined,
    nrcNumber: formData.get("nrcNumber") || undefined,
    emergencyContact: formData.get("emergencyContact") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { name, dob, gender, ...rest } = parsed.data;

  await prisma.$transaction([
    prisma.user.update({ where: { id: session.user.id }, data: { name } }),
    prisma.doctorProfile.update({
      where: { id: doctorId },
      data: {
        dob: dob ? new Date(dob) : null,
        gender: gender ?? null,
        phone: rest.phone ?? null,
        address: rest.address ?? null,
        nrcNumber: rest.nrcNumber ?? null,
        emergencyContact: rest.emergencyContact ?? null,
      },
    }),
  ]);

  revalidatePath("/doctor/profile");
  return { success: true };
}

const ownDoctorProfileSchema = z.object({
  specialty: z.string().optional(),
  qualifications: z.string().optional(),
  medicalLicenseNo: z.string().optional(),
  mbbsUniversity: z.string().optional(),
  graduationYear: z.coerce.number().int().min(1900).max(2100).optional(),
  languages: z.array(z.string()).optional(),
  professionalBio: z.string().optional(),
  clinicRoom: z.string().optional(),
});

export type UpdateOwnDoctorProfileState = { error?: string; success?: boolean };

export async function updateOwnDoctorProfile(
  _prevState: UpdateOwnDoctorProfileState,
  formData: FormData
): Promise<UpdateOwnDoctorProfileState> {
  const session = await requireRole(["DOCTOR"]);
  const doctorId = session.user.doctorId;
  if (!doctorId) throw new UnauthorizedError("No doctor profile");

  const parsed = ownDoctorProfileSchema.safeParse({
    specialty: formData.get("specialty") || undefined,
    qualifications: formData.get("qualifications") || undefined,
    medicalLicenseNo: formData.get("medicalLicenseNo") || undefined,
    mbbsUniversity: formData.get("mbbsUniversity") || undefined,
    graduationYear: formData.get("graduationYear") || undefined,
    languages: formData.getAll("languages"),
    professionalBio: formData.get("professionalBio") || undefined,
    clinicRoom: formData.get("clinicRoom") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const specialtyError = await validateSpecialty(parsed.data.specialty);
  if (specialtyError) return { error: specialtyError };

  await prisma.doctorProfile.update({
    where: { id: doctorId },
    data: {
      specialty: parsed.data.specialty ?? null,
      qualifications: parsed.data.qualifications ?? null,
      medicalLicenseNo: parsed.data.medicalLicenseNo ?? null,
      mbbsUniversity: parsed.data.mbbsUniversity ?? null,
      graduationYear: parsed.data.graduationYear ?? null,
      languages: parsed.data.languages ?? [],
      professionalBio: parsed.data.professionalBio ?? null,
      clinicRoom: parsed.data.clinicRoom ?? null,
    },
  });

  revalidatePath("/doctor/profile");
  return { success: true };
}

export type DoctorPreferenceField =
  | "notifyNewAppointments"
  | "notifyAppointmentCancelled"
  | "notifyPatientWaiting"
  | "notifyLabResults"
  | "notifyAnnouncements"
  | "notifyScheduleReminders"
  | "notifyLeaveRequestStatus";

export async function updateDoctorNotificationSetting(
  field: DoctorPreferenceField,
  value: boolean
) {
  const session = await requireRole(["DOCTOR"]);
  const doctorId = session.user.doctorId;
  if (!doctorId) throw new UnauthorizedError("No doctor profile");

  await prisma.doctorProfile.update({
    where: { id: doctorId },
    data: { [field]: value },
  });

  revalidatePath("/doctor/profile");
}

const ownStaffPersonalInfoSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
});

export type UpdateOwnStaffPersonalInfoState = { error?: string; success?: boolean };

export async function updateOwnStaffPersonalInfo(
  _prevState: UpdateOwnStaffPersonalInfoState,
  formData: FormData
): Promise<UpdateOwnStaffPersonalInfoState> {
  const session = await requireRole(STAFF_ROLES);

  const parsed = ownStaffPersonalInfoSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { name: parsed.data.name, phone: parsed.data.phone ?? null },
  });

  revalidatePath("/staff/profile");
  return { success: true };
}

export type StaffPreferenceField =
  | "notifyNewAppointments"
  | "notifyLowStock"
  | "notifyAnnouncements"
  | "notifyBilling";

export async function updateStaffNotificationSetting(field: StaffPreferenceField, value: boolean) {
  const session = await requireRole(STAFF_ROLES);

  await prisma.user.update({
    where: { id: session.user.id },
    data: { [field]: value },
  });

  revalidatePath("/staff/profile");
}

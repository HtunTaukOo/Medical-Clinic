"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { logActivity } from "@/lib/audit";
import { parseDateOnlyInput } from "@/lib/doctor-availability";

const staffSchema = z.object({
  name: z.string().min(1),
  email: z.email(),
  password: z.string().min(8),
  role: z.enum(["ADMIN", "DOCTOR", "RECEPTIONIST", "PHARMACIST", "LAB_TECH"]),
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
    specialty: formData.get("specialty") || undefined,
    consultationFee: formData.get("consultationFee") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { name, email, password, role, specialty, consultationFee } = parsed.data;

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
      doctorProfile:
        role === "DOCTOR" ? { create: { specialty, consultationFee } } : undefined,
    },
  });

  revalidatePath("/staff/users");
  return { success: true };
}

const feeSchema = z.object({
  consultationFee: z.coerce.number().nonnegative(),
});

export type DoctorFeeFormState = { error?: string; success?: boolean };

export async function updateDoctorFee(
  doctorId: string,
  _prevState: DoctorFeeFormState,
  formData: FormData
): Promise<DoctorFeeFormState> {
  await requireRole(["ADMIN"]);

  const parsed = feeSchema.safeParse({
    consultationFee: formData.get("consultationFee"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await prisma.doctorProfile.update({
    where: { id: doctorId },
    data: { consultationFee: parsed.data.consultationFee },
  });

  revalidatePath("/staff/users");
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
  await requireRole(["ADMIN"]);

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
  return { success: true };
}

export async function removeDoctorLeave(leaveId: string) {
  await requireRole(["ADMIN"]);
  const leave = await prisma.doctorLeave.delete({ where: { id: leaveId } });
  revalidatePath(`/staff/users/${leave.doctorId}/availability`);
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

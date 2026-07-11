"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";

const staffSchema = z.object({
  name: z.string().min(1),
  email: z.email(),
  password: z.string().min(8),
  role: z.enum(["ADMIN", "DOCTOR", "RECEPTIONIST", "PHARMACIST"]),
  specialty: z.string().optional(),
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
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { name, email, password, role, specialty } = parsed.data;

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
      doctorProfile: role === "DOCTOR" ? { create: { specialty } } : undefined,
    },
  });

  revalidatePath("/staff/users");
  return { success: true };
}

export async function toggleStaffActive(userId: string) {
  await requireRole(["ADMIN"]);

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  await prisma.user.update({
    where: { id: userId },
    data: { active: !user.active },
  });

  revalidatePath("/staff/users");
}

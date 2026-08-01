"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, STAFF_ROLES } from "@/lib/authz";

export async function clockIn() {
  const session = await requireRole(STAFF_ROLES);

  const open = await prisma.attendanceRecord.findFirst({
    where: { userId: session.user.id, clockOut: null },
  });
  if (open) return;

  await prisma.attendanceRecord.create({
    data: { userId: session.user.id, clockIn: new Date() },
  });

  revalidatePath("/staff/attendance");
}

export async function clockOut() {
  const session = await requireRole(STAFF_ROLES);

  const open = await prisma.attendanceRecord.findFirst({
    where: { userId: session.user.id, clockOut: null },
    orderBy: { clockIn: "desc" },
  });
  if (!open) return;

  await prisma.attendanceRecord.update({
    where: { id: open.id },
    data: { clockOut: new Date() },
  });

  revalidatePath("/staff/attendance");
}

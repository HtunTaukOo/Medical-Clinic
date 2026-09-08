import { prisma } from "@/lib/prisma";

// Specialties are admin-managed data (see actions/specialties.ts), not a
// fixed enum — these are the DB-backed reads every consumer (booking, the
// specialty dropdowns, server-side validation) shares.
export async function getActiveSpecialties() {
  return prisma.specialty.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });
}

export async function getAllSpecialties() {
  return prisma.specialty.findMany({ orderBy: { sortOrder: "asc" } });
}

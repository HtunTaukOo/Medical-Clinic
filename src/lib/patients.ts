import type { Prisma, PrismaClient } from "@prisma/client";

export const GENDER_LABELS: Record<string, string> = {
  MALE: "Male",
  FEMALE: "Female",
  OTHER: "Other",
};

// "NCA-2026-00412" — scoped per calendar year. Pre-checks for a free candidate
// rather than relying purely on the unique constraint, since patient creation
// happens at low enough volume here that a race is very unlikely.
export async function generatePatientCode(
  db: PrismaClient | Prisma.TransactionClient
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `NCA-${year}-`;
  const count = await db.patient.count({ where: { patientCode: { startsWith: prefix } } });

  for (let offset = 1; offset <= 5; offset++) {
    const candidate = `${prefix}${String(count + offset).padStart(5, "0")}`;
    const existing = await db.patient.findUnique({ where: { patientCode: candidate } });
    if (!existing) return candidate;
  }
  return `${prefix}${Date.now().toString().slice(-5)}`;
}

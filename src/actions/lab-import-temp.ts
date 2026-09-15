"use server";

// TEMPORARY one-off action, backing the /staff/lab-import admin page. Exists
// only because DATABASE_URL is a Sensitive Vercel env var and can't be
// pulled to run scripts/import-lab-tests.ts + import-clinic-services-from-
// lab-tests.ts against production from a local machine — this runs the same
// logic using the app's own already-configured Prisma client instead.
// DELETE this file, the page, and its component once the production import
// is done and verified.
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { revalidatePath } from "next/cache";
import { LAB_TEST_IMPORT_DATA } from "@/lib/lab-test-import-data";

const SPECIALTY_NAME = "Lab Visit";
const DURATION_MINUTES = 15;

export type LabImportResult = { lines: string[] };

async function computeLabTestPlan() {
  const existing = await prisma.labTest.findMany({ select: { name: true } });
  const existingNames = new Set(existing.map((t) => t.name.trim().toLowerCase()));
  const toCreate = LAB_TEST_IMPORT_DATA.filter((t) => !existingNames.has(t.name.trim().toLowerCase()));
  const skipped = LAB_TEST_IMPORT_DATA.filter((t) => existingNames.has(t.name.trim().toLowerCase()));
  return { toCreate, skipped };
}

export async function previewLabImport(): Promise<LabImportResult> {
  await requireRole(["ADMIN"]);

  const specialty = await prisma.specialty.findFirst({ where: { name: SPECIALTY_NAME } });
  const { toCreate, skipped } = await computeLabTestPlan();
  const currentUnlinked = await prisma.labTest.count({ where: { clinicService: null } });

  const lines: string[] = [];
  lines.push(
    `Specialty "${SPECIALTY_NAME}": ${specialty ? (specialty.active ? "found, active" : "found but INACTIVE — would block the run") : "NOT FOUND — would block the run"}`
  );
  lines.push(`Would create ${toCreate.length} LabTest row(s).`);
  if (toCreate.length > 0) {
    lines.push(...toCreate.map((t) => `  - ${t.name} (K ${t.price.toLocaleString()})`));
  }
  lines.push(
    `Would skip ${skipped.length} already-existing name(s): ${skipped.map((t) => t.name).join(", ") || "none"}`
  );
  lines.push(
    `${currentUnlinked} LabTest(s) currently unlinked to a ClinicService; after import that becomes ${currentUnlinked + toCreate.length}, all of which would get a new "Lab Visit" ClinicService.`
  );
  return { lines };
}

export async function runLabImport(): Promise<LabImportResult> {
  await requireRole(["ADMIN"]);

  const specialty = await prisma.specialty.findFirst({ where: { name: SPECIALTY_NAME } });
  if (!specialty) throw new Error(`Specialty "${SPECIALTY_NAME}" not found — create it first.`);
  if (!specialty.active) throw new Error(`Specialty "${SPECIALTY_NAME}" exists but is inactive — activate it first.`);

  const { toCreate, skipped } = await computeLabTestPlan();
  const lines: string[] = [];

  if (toCreate.length > 0) {
    await prisma.labTest.createMany({
      data: toCreate.map((t) => ({ name: t.name, price: t.price })),
    });
  }
  lines.push(`Created ${toCreate.length} LabTest row(s).`);
  if (skipped.length > 0) {
    lines.push(`Skipped ${skipped.length} already-existing name(s): ${skipped.map((t) => t.name).join(", ")}`);
  }

  const unlinked = await prisma.labTest.findMany({
    where: { clinicService: null },
    orderBy: { name: "asc" },
  });
  if (unlinked.length > 0) {
    await prisma.clinicService.createMany({
      data: unlinked.map((t) => ({
        name: t.name,
        specialty: SPECIALTY_NAME,
        durationMinutes: DURATION_MINUTES,
        price: t.price,
        active: true,
        labTestId: t.id,
      })),
    });
  }
  lines.push(`Created ${unlinked.length} ClinicService row(s) under "${SPECIALTY_NAME}".`);

  revalidatePath("/staff/lab");
  revalidatePath("/staff/clinic-services");
  return { lines };
}

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
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { LAB_TEST_IMPORT_DATA } from "@/lib/lab-test-import-data";

const SPECIALTY_NAME = "Lab Visit";
const DURATION_MINUTES = 15;
const LAB_PROVIDER_EMAIL = "labdoctor@nca.clinic";

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

// "Lab Visit" is a SERVICE_CAPACITY specialty — booking it auto-assigns
// whichever DoctorProfile has specialty="Lab Visit" as the Appointment.
// doctorId FK placeholder (patients never see this name; the UI shows the
// service name instead — see src/lib/appointment-provider.ts). Local dev
// gets this from prisma/seed.ts, but seed data was never run against
// production, so the placeholder — and therefore Lab Visit booking itself —
// is currently missing there entirely.
export async function checkLabVisitProvider(): Promise<LabImportResult> {
  await requireRole(["ADMIN"]);
  const lines: string[] = [];

  const specialty = await prisma.specialty.findFirst({ where: { name: SPECIALTY_NAME } });
  lines.push(
    `Specialty "${SPECIALTY_NAME}": ${specialty ? (specialty.active ? "found, active" : "found but INACTIVE") : "NOT FOUND"}`
  );

  const provider = await prisma.doctorProfile.findFirst({ where: { specialty: SPECIALTY_NAME } });
  if (provider) {
    lines.push(`Placeholder provider already exists — Lab Visit booking should already work.`);
  } else {
    lines.push(
      `No DoctorProfile has specialty="${SPECIALTY_NAME}" — Lab Visit booking is currently BROKEN (both the patient wizard and staff manual booking auto-assign via this lookup and will fail with "No staff are set up for this specialty yet").`
    );
  }
  return { lines };
}

export async function createLabVisitProvider(): Promise<LabImportResult> {
  await requireRole(["ADMIN"]);

  const existing = await prisma.doctorProfile.findFirst({ where: { specialty: SPECIALTY_NAME } });
  if (existing) {
    return { lines: [`Already exists — nothing to do.`] };
  }

  // Random, never-surfaced password — nobody is meant to log into this
  // account (it's pure FK plumbing), so it must not use the local seed's
  // well-known "password123".
  const passwordHash = await bcrypt.hash(randomBytes(32).toString("hex"), 10);

  const user = await prisma.user.upsert({
    where: { email: LAB_PROVIDER_EMAIL },
    update: {},
    create: {
      email: LAB_PROVIDER_EMAIL,
      passwordHash,
      name: "Lab Visit Scheduling",
      role: "DOCTOR",
      doctorProfile: {
        create: {
          specialty: SPECIALTY_NAME,
          consultationFee: 0,
          // Every day, all day — this placeholder isn't a real doctor with
          // real hours, it's pure FK plumbing for a SERVICE_CAPACITY
          // specialty's Appointment.doctorId. A narrower default here
          // silently becomes a second, tighter availability ceiling on top
          // of the clinic's own configured hours (see the migration that
          // widened the existing row after this bit patients out of
          // booking evening Lab Visit slots the clinic was actually open
          // for).
          workingDays: [0, 1, 2, 3, 4, 5, 6],
          shifts: {
            create: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startTime: "00:00", endTime: "23:59" })),
          },
          experienceYears: 5,
          qualifications: "MBBS, Dip.Clin.Path",
        },
      },
    },
  });

  revalidatePath("/staff/doctors");
  revalidatePath("/staff/users");
  return { lines: [`Created placeholder provider "${user.name}" (${user.email}) for "${SPECIALTY_NAME}".`] };
}

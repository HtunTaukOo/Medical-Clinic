// One-off: create a ClinicService (under "Lab Visit") for every LabTest that
// doesn't already have one linked, so the newly-imported tests (see
// import-lab-tests.ts) become bookable/billable, not just clinical catalog
// entries. Run locally against the dev DB with:
//   npx tsx scripts/import-clinic-services-from-lab-tests.ts
// Add --dry-run to only print what would be created, with no writes.
// Safe to re-run: only targets LabTests with clinicService === null.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

const SPECIALTY_NAME = "Lab Visit";
const DURATION_MINUTES = 15;

async function main() {
  const specialty = await prisma.specialty.findFirst({ where: { name: SPECIALTY_NAME } });
  if (!specialty) {
    throw new Error(`Specialty "${SPECIALTY_NAME}" not found — create it first.`);
  }
  if (!specialty.active) {
    throw new Error(`Specialty "${SPECIALTY_NAME}" exists but is inactive — activate it first.`);
  }

  const unlinkedLabTests = await prisma.labTest.findMany({
    where: { clinicService: null },
    orderBy: { name: "asc" },
  });

  if (unlinkedLabTests.length === 0) {
    console.log("No unlinked lab tests found — nothing to do.");
    return;
  }

  if (!DRY_RUN) {
    await prisma.clinicService.createMany({
      data: unlinkedLabTests.map((t) => ({
        name: t.name,
        specialty: SPECIALTY_NAME,
        durationMinutes: DURATION_MINUTES,
        price: t.price,
        active: true,
        labTestId: t.id,
      })),
    });
  }

  console.log(
    `${DRY_RUN ? "[DRY RUN] Would create" : "Created"} ${unlinkedLabTests.length} clinic service(s) under "${SPECIALTY_NAME}":`
  );
  for (const t of unlinkedLabTests) {
    console.log(`  - ${t.name} (K ${Number(t.price).toLocaleString()})`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

// One-off bulk import of LabTest rows from the clinic's paper price sheet.
// Run locally against the dev DB with: npx tsx scripts/import-lab-tests.ts
// Add --dry-run to only print what would be created, with no writes.
// Safe to re-run: skips any name that already exists (case-insensitive).
import { PrismaClient } from "@prisma/client";
import { LAB_TEST_IMPORT_DATA } from "../src/lib/lab-test-import-data";

const DRY_RUN = process.argv.includes("--dry-run");

const prisma = new PrismaClient();

const labTests = LAB_TEST_IMPORT_DATA;

async function main() {
  const existing = await prisma.labTest.findMany({ select: { name: true } });
  const existingNames = new Set(existing.map((t) => t.name.trim().toLowerCase()));

  const toCreate = labTests.filter((t) => !existingNames.has(t.name.trim().toLowerCase()));
  const skipped = labTests.filter((t) => existingNames.has(t.name.trim().toLowerCase()));

  if (toCreate.length > 0 && !DRY_RUN) {
    await prisma.labTest.createMany({
      data: toCreate.map((t) => ({ name: t.name, price: t.price })),
    });
  }

  console.log(`${DRY_RUN ? "[DRY RUN] Would create" : "Created"} ${toCreate.length} lab test(s):`);
  for (const t of toCreate) {
    console.log(`  - ${t.name} (K ${t.price.toLocaleString()})`);
  }
  if (skipped.length > 0) {
    console.log(`Skipped ${skipped.length} already-existing name(s): ${skipped.map((t) => t.name).join(", ")}`);
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

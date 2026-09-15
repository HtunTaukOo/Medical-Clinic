// One-off: remove the VitD duplicate (kept 48,000, per user confirmation)
// and two leftover "Sanity" junk LabTest rows, plus their linked
// ClinicService rows, picked up by the bulk import scripts.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const namesToDelete = ["VitD (2)", "Sanity RequestSubmit", "Sanity Test XYZ"];

async function main() {
  for (const name of namesToDelete) {
    const labTest = await prisma.labTest.findFirst({ where: { name } });
    if (!labTest) {
      console.log(`Not found (already gone?): ${name}`);
      continue;
    }
    const svc = await prisma.clinicService.findUnique({ where: { labTestId: labTest.id } });
    if (svc) {
      await prisma.clinicService.delete({ where: { id: svc.id } });
      console.log(`Deleted ClinicService: ${svc.name}`);
    }
    await prisma.labTest.delete({ where: { id: labTest.id } });
    console.log(`Deleted LabTest: ${labTest.name}`);
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

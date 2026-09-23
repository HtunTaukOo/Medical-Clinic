// One-off bulk import of Medicine rows from the clinic's supplier price
// sheet. Run locally against the dev DB with: npx tsx scripts/import-medicines.ts
// Add --dry-run to only print what would be created, with no writes.
// Safe to re-run: skips any name that already exists (case-insensitive).
import { PrismaClient } from "@prisma/client";
import { MEDICINE_IMPORT_DATA } from "../src/lib/medicine-import-data";

const DRY_RUN = process.argv.includes("--dry-run");
const DAY_MS = 24 * 60 * 60 * 1000;

const prisma = new PrismaClient();

// See src/actions/medicine-import-temp.ts for the rationale — kept in sync
// with that file's version of this function.
function assignInventory(index: number, price: number) {
  const baseStock = price < 5000 ? 150 : price < 15000 ? 60 : price < 30000 ? 25 : 10;
  const reorderLevel = Math.max(5, Math.round(baseStock * 0.25));

  const stockBucket = index % 20;
  let stockQty: number;
  if (stockBucket < 13) {
    stockQty = baseStock + ((index * 7) % baseStock);
  } else if (stockBucket < 18) {
    stockQty = Math.max(1, Math.round(reorderLevel * (0.3 + (index % 5) * 0.15)));
  } else {
    stockQty = 0;
  }

  const expiryBucket = (index * 3 + 7) % 20;
  let expiryDate: Date;
  if (expiryBucket < 2) {
    expiryDate = new Date(Date.now() - (5 + (index % 50)) * DAY_MS);
  } else if (expiryBucket < 5) {
    expiryDate = new Date(Date.now() + (3 + (index % 25)) * DAY_MS);
  } else {
    expiryDate = new Date(Date.now() + (90 + ((index * 11) % 630)) * DAY_MS);
  }

  return { stockQty, reorderLevel, expiryDate };
}

async function main() {
  const existing = await prisma.medicine.findMany({ select: { name: true } });
  const existingNames = new Set(existing.map((m) => m.name.trim().toLowerCase()));

  const planned = MEDICINE_IMPORT_DATA.map((row, index) => ({ row, ...assignInventory(index, row.price) }));
  const toCreate = planned.filter((p) => !existingNames.has(p.row.name.trim().toLowerCase()));
  const skipped = planned.filter((p) => existingNames.has(p.row.name.trim().toLowerCase()));

  if (toCreate.length > 0 && !DRY_RUN) {
    await prisma.medicine.createMany({
      data: toCreate.map((p) => ({
        name: p.row.name,
        unit: p.row.unit,
        brand: p.row.generic || null,
        category: p.row.category,
        price: p.row.price,
        stockQty: p.stockQty,
        reorderLevel: p.reorderLevel,
        expiryDate: p.expiryDate,
      })),
    });
  }

  console.log(`${DRY_RUN ? "[DRY RUN] Would create" : "Created"} ${toCreate.length} medicine(s):`);
  for (const p of toCreate) {
    console.log(`  - ${p.row.name} (MMK ${p.row.price.toLocaleString()}, qty ${p.stockQty})`);
  }
  if (skipped.length > 0) {
    console.log(
      `Skipped ${skipped.length} already-existing name(s): ${skipped.map((p) => p.row.name).join(", ")}`
    );
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

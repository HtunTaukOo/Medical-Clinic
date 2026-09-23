"use server";

// TEMPORARY one-off action, backing the /staff/medicine-import admin page.
// Exists only because DATABASE_URL is a Sensitive Vercel env var and can't be
// pulled to run scripts/import-medicines.ts against production from a local
// machine — this runs the same logic using the app's own already-configured
// Prisma client instead. DELETE this file, the page, and its component once
// the production import is done and verified.
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { revalidatePath } from "next/cache";
import { MEDICINE_IMPORT_DATA, type MedicineImportRow } from "@/lib/medicine-import-data";
import { getStockStatus, getExpiryStatus } from "@/lib/inventory";

export type MedicineImportResult = { lines: string[] };

const DAY_MS = 24 * 60 * 60 * 1000;

// Deterministic (not truly random, so re-running --dry-run always shows the
// same plan) but varied assignment of stock/expiry per row, so the catalog
// exercises every status badge the UI has (in/low/out of stock, expiring
// soon, expired) instead of every row looking identical. Cheaper items get a
// deeper baseline stock (higher turnover, bought in bulk); pricier items a
// shallower one — mirrors how a real clinic pharmacy stocks a price sheet
// like this.
function assignInventory(index: number, price: number) {
  const baseStock = price < 5000 ? 150 : price < 15000 ? 60 : price < 30000 ? 25 : 10;
  const reorderLevel = Math.max(5, Math.round(baseStock * 0.25));

  const stockBucket = index % 20; // 0-12 in stock, 13-17 low stock, 18-19 out of stock
  let stockQty: number;
  if (stockBucket < 13) {
    stockQty = baseStock + ((index * 7) % baseStock);
  } else if (stockBucket < 18) {
    stockQty = Math.max(1, Math.round(reorderLevel * (0.3 + (index % 5) * 0.15)));
  } else {
    stockQty = 0;
  }

  const expiryBucket = (index * 3 + 7) % 20; // 0-1 expired, 2-4 expiring soon, rest healthy
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

function buildPlanRows() {
  return MEDICINE_IMPORT_DATA.map((row, index) => ({
    row,
    ...assignInventory(index, row.price),
  }));
}

async function computeMedicinePlan() {
  const existing = await prisma.medicine.findMany({ select: { name: true } });
  const existingNames = new Set(existing.map((m) => m.name.trim().toLowerCase()));
  const planned = buildPlanRows();
  const toCreate = planned.filter((p) => !existingNames.has(p.row.name.trim().toLowerCase()));
  const skipped = planned.filter((p) => existingNames.has(p.row.name.trim().toLowerCase()));
  return { toCreate, skipped };
}

function summarizeRow(row: MedicineImportRow, stockQty: number, reorderLevel: number, expiryDate: Date) {
  const stockStatus = getStockStatus(stockQty, reorderLevel);
  const expiryStatus = getExpiryStatus(expiryDate);
  const flags = [stockStatus.replace("_", " ").toLowerCase(), expiryStatus].filter(Boolean).join(", ");
  return `  - ${row.name} — MMK ${row.price.toLocaleString()}, qty ${stockQty} (${flags})`;
}

export async function previewMedicineImport(): Promise<MedicineImportResult> {
  await requireRole(["ADMIN"]);

  const { toCreate, skipped } = await computeMedicinePlan();
  const lines: string[] = [];
  lines.push(`Would create ${toCreate.length} Medicine row(s).`);
  lines.push(...toCreate.map((p) => summarizeRow(p.row, p.stockQty, p.reorderLevel, p.expiryDate)));
  if (skipped.length > 0) {
    lines.push(
      `Would skip ${skipped.length} already-existing name(s): ${skipped.map((p) => p.row.name).join(", ")}`
    );
  }
  return { lines };
}

export async function runMedicineImport(): Promise<MedicineImportResult> {
  await requireRole(["ADMIN"]);

  const { toCreate, skipped } = await computeMedicinePlan();
  const lines: string[] = [];

  if (toCreate.length > 0) {
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
  lines.push(`Created ${toCreate.length} Medicine row(s).`);
  if (skipped.length > 0) {
    lines.push(`Skipped ${skipped.length} already-existing name(s): ${skipped.map((p) => p.row.name).join(", ")}`);
  }

  revalidatePath("/staff/inventory");
  revalidatePath("/staff/pharmacy");
  revalidatePath("/portal/medicines");
  return { lines };
}

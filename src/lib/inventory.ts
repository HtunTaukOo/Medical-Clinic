export const EXPIRY_WARNING_DAYS = 30;

export function getExpiryStatus(expiryDate: Date | null): "expired" | "expiring" | null {
  if (!expiryDate) return null;
  const now = new Date();
  const warningCutoff = new Date(now.getTime() + EXPIRY_WARNING_DAYS * 24 * 60 * 60 * 1000);
  if (expiryDate <= now) return "expired";
  if (expiryDate <= warningCutoff) return "expiring";
  return null;
}

export type StockStatus = "OUT_OF_STOCK" | "LOW_STOCK" | "IN_STOCK";

export function getStockStatus(stockQty: number, reorderLevel: number): StockStatus {
  if (stockQty === 0) return "OUT_OF_STOCK";
  if (stockQty <= reorderLevel) return "LOW_STOCK";
  return "IN_STOCK";
}

export const STOCK_STATUS_LABEL: Record<StockStatus, string> = {
  OUT_OF_STOCK: "out of stock",
  LOW_STOCK: "low stock",
  IN_STOCK: "in stock",
};

export const STOCK_STATUS_CLASS: Record<StockStatus, string> = {
  OUT_OF_STOCK: "bg-rose-100 text-rose-700",
  LOW_STOCK: "bg-amber-100 text-amber-700",
  IN_STOCK: "bg-emerald-100 text-emerald-700",
};

export const EXPIRY_WARNING_DAYS = 30;

export function getExpiryStatus(expiryDate: Date | null): "expired" | "expiring" | null {
  if (!expiryDate) return null;
  const now = new Date();
  const warningCutoff = new Date(now.getTime() + EXPIRY_WARNING_DAYS * 24 * 60 * 60 * 1000);
  if (expiryDate <= now) return "expired";
  if (expiryDate <= warningCutoff) return "expiring";
  return null;
}

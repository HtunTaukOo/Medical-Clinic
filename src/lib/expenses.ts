export const EXPENSE_CATEGORIES = [
  "RENT",
  "UTILITIES",
  "SALARIES",
  "SUPPLIES",
  "EQUIPMENT",
  "MAINTENANCE",
  "MARKETING",
  "INSURANCE",
  "OTHER",
] as const;

export type ExpenseCategoryValue = (typeof EXPENSE_CATEGORIES)[number];

// Staff can only record day-to-day operational costs — Rent, Salaries,
// Insurance, Marketing, and Utilities are treated as admin-level financial
// matters, enforced server-side in src/actions/expenses.ts (not just hidden
// in the UI).
export const STAFF_EXPENSE_CATEGORIES = [
  "SUPPLIES",
  "EQUIPMENT",
  "MAINTENANCE",
  "OTHER",
] as const satisfies readonly ExpenseCategoryValue[];

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategoryValue, string> = {
  RENT: "Rent",
  UTILITIES: "Utilities",
  SALARIES: "Salaries",
  SUPPLIES: "Supplies",
  EQUIPMENT: "Equipment",
  MAINTENANCE: "Maintenance",
  MARKETING: "Marketing",
  INSURANCE: "Insurance",
  OTHER: "Other",
};

// Display order for grouping lab tests/services in the patient booking
// wizard — see prisma/schema.prisma's LabTestCategory enum for the source
// of truth on values, and messages/*.json's portal.booking.labCategory.*
// for the patient-facing labels. Ordered roughly by how often a patient
// would recognize/want these, with the catch-all bucket last.
export const LAB_TEST_CATEGORIES = [
  "BLOOD_HEALTH",
  "DIABETES",
  "HEART_HEALTH",
  "LIVER_HEALTH",
  "KIDNEY_ELECTROLYTES",
  "THYROID_HORMONE",
  "INFECTION_SCREENING",
  "IMMUNE_AUTOIMMUNE",
  "URINE_STOOL",
  "WOMENS_HEALTH",
  "GENERAL_HEALTH",
] as const;

export type LabTestCategoryKey = (typeof LAB_TEST_CATEGORIES)[number];

// English-only labels for the staff portal (Laboratory page, Test Catalog),
// which — unlike the patient-facing booking wizard — isn't run through
// next-intl anywhere else today. Patient-facing labels instead come from
// messages/*.json's portal.booking.labCategory.* so they're translated.
export const LAB_TEST_CATEGORY_LABELS: Record<LabTestCategoryKey, string> = {
  BLOOD_HEALTH: "Blood Health",
  DIABETES: "Diabetes Screening",
  HEART_HEALTH: "Heart Health",
  LIVER_HEALTH: "Liver Health",
  KIDNEY_ELECTROLYTES: "Kidney & Electrolytes",
  THYROID_HORMONE: "Thyroid & Hormones",
  INFECTION_SCREENING: "Infection Screening",
  IMMUNE_AUTOIMMUNE: "Immune & Autoimmune",
  URINE_STOOL: "Urine & Stool",
  WOMENS_HEALTH: "Women's & Pregnancy Care",
  GENERAL_HEALTH: "General Health",
};

// Reverse lookup from a patient-bookable "Lab Visit" ClinicService's name
// (e.g. "Blood Health") back to its LabTestCategory — those 11 services are
// named exactly after their category label (see the migration that seeded
// them), so this is how staff-side code finds "which tests belong to the
// category this appointment was booked under" without ClinicService needing
// its own category column.
export function labTestCategoryFromLabel(label: string): LabTestCategoryKey | null {
  const entry = (Object.entries(LAB_TEST_CATEGORY_LABELS) as [LabTestCategoryKey, string][]).find(
    ([, l]) => l === label
  );
  return entry?.[0] ?? null;
}

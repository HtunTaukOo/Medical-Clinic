-- Drop the ClinicService.category field — turned out to be unnecessary:
-- once the per-test services below are gone, every remaining "Lab Visit"
-- ClinicService IS a category (named after one, e.g. "Heart Health"), so
-- there's nothing left to disambiguate with a separate column.
ALTER TABLE "ClinicService" DROP COLUMN "category";

-- Remove the ~87 old per-test "Lab Visit" services (CBC Test, Lipid Profile
-- Test, etc.) — only the 11 category-level services (labTestId IS NULL)
-- should remain bookable/listed. Any Appointment or InvoiceItem that
-- referenced one of these keeps existing (labTestId/clinicServiceId both
-- SET NULL on delete) — it just loses the service's display name, same as
-- any other deleted ClinicService already behaves.
DELETE FROM "ClinicService" WHERE "labTestId" IS NOT NULL;

-- AlterTable
ALTER TABLE "ClinicService" ADD COLUMN     "category" "LabTestCategory";

-- Seed the patient-bookable, category-level "Lab Visit" services. A patient
-- books one of these (e.g. "Heart Health"), not a specific test — staff pick
-- the actual LabTest(s) afterwards via the Laboratory page's "New Test" tab,
-- based on the patient's reason for the visit. labTestId is intentionally
-- left NULL (these aren't tied to one specific test); price is the cheapest
-- test in that category today, shown to patients as a "from" price. The
-- older per-test ClinicServices (CBC Test, Lipid Profile Test, etc.) are
-- left untouched — they're no longer shown in the booking wizard (which now
-- only lists category-level services) but stay available for staff to pick
-- from when itemizing an invoice.
INSERT INTO "ClinicService" ("id", "name", "specialty", "durationMinutes", "price", "active", "category", "createdAt", "updatedAt") VALUES
  ('labcat-blood-health',        'Blood Health',              'Lab Visit', 15, 4500,  true, 'BLOOD_HEALTH',        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('labcat-diabetes',            'Diabetes Screening',        'Lab Visit', 15, 6000,  true, 'DIABETES',            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('labcat-heart-health',        'Heart Health',               'Lab Visit', 15, 6500,  true, 'HEART_HEALTH',        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('labcat-liver-health',        'Liver Health',               'Lab Visit', 15, 6500,  true, 'LIVER_HEALTH',        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('labcat-kidney-electrolytes', 'Kidney & Electrolytes',      'Lab Visit', 15, 6500,  true, 'KIDNEY_ELECTROLYTES', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('labcat-thyroid-hormone',     'Thyroid & Hormones',         'Lab Visit', 15, 20000, true, 'THYROID_HORMONE',     CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('labcat-infection-screening', 'Infection Screening',        'Lab Visit', 15, 7500,  true, 'INFECTION_SCREENING', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('labcat-immune-autoimmune',   'Immune & Autoimmune',        'Lab Visit', 15, 7000,  true, 'IMMUNE_AUTOIMMUNE',   CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('labcat-urine-stool',         'Urine & Stool',              'Lab Visit', 15, 6000,  true, 'URINE_STOOL',         CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('labcat-womens-health',       'Women''s & Pregnancy Care',  'Lab Visit', 15, 48000, true, 'WOMENS_HEALTH',       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('labcat-general-health',      'General Health',             'Lab Visit', 15, 12000, true, 'GENERAL_HEALTH',      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

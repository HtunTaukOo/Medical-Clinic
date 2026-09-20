-- CreateEnum
CREATE TYPE "LabTestCategory" AS ENUM ('BLOOD_HEALTH', 'DIABETES', 'HEART_HEALTH', 'LIVER_HEALTH', 'KIDNEY_ELECTROLYTES', 'THYROID_HORMONE', 'INFECTION_SCREENING', 'IMMUNE_AUTOIMMUNE', 'URINE_STOOL', 'WOMENS_HEALTH', 'GENERAL_HEALTH');

-- AlterTable
ALTER TABLE "LabTest" ADD COLUMN     "category" "LabTestCategory" NOT NULL DEFAULT 'GENERAL_HEALTH';

-- Backfill categories for every test name known at the time of this
-- migration (the clinic's seeded 5 + the ~90-test paper price-sheet import,
-- see src/lib/lab-test-import-data.ts). Anything not matched below — new
-- tests added later, or the odd unmatched name — keeps the column default
-- of GENERAL_HEALTH, which is a safe catch-all bucket, not an error state.
UPDATE "LabTest" SET "category" = 'HEART_HEALTH' WHERE "name" IN (
  'Cholesterol', 'HDL', 'LDL', 'Triglyceride', 'Lipid Profile', 'CK', 'CKMB', 'Trop T', 'Trop I'
);

UPDATE "LabTest" SET "category" = 'LIVER_HEALTH' WHERE "name" IN (
  'Tbil', 'ALP', 'ALT', 'AST', 'Liver Function Test', 'GGT', 'Albumin', 'Total Protein'
);

UPDATE "LabTest" SET "category" = 'IMMUNE_AUTOIMMUNE' WHERE "name" IN (
  'ANA titer', 'ENA profile', 'RA (Quali)', 'ANF', 'Anti CCP', 'ASO (Quali)', 'ASO (Quanti)'
);

UPDATE "LabTest" SET "category" = 'INFECTION_SCREENING' WHERE "name" IN (
  'VDRL', 'TPHA', 'HCV Ab (ELISA)', 'HbsAg (ELISA)', 'HIV Ab (ELISA)', 'HAV Ab (IgM)', 'HBs Ab (Quanti)',
  'procalcitonin, PCT', 'C&S (Urine)', 'C&S (Blood)', 'AFB (Fluid, urine, CSF)', 'Sputum AFB',
  'Dengue Profile', 'TB ICT', 'MP ICT', 'Widal test', 'CRP (Quanti)'
);

UPDATE "LabTest" SET "category" = 'DIABETES' WHERE "name" IN (
  'OGTT (Glucose)', 'Fasting Blood Sugar', 'Hb A1c', 'Blood ketone'
);

UPDATE "LabTest" SET "category" = 'BLOOD_HEALTH' WHERE "name" IN (
  'Complete Blood Count (CBC)', 'CP', 'CP with blood film', 'Hb%', 'ABO, Rh', 'PLT count', 'PCV',
  'Retic count', 'ESR', 'G6PD (Quanti)', 'BT, CT', 'Coomb test', 'PT/INR', 'Iron study', 'TIBC',
  'serum Iron', 'Ferritin', 'B-combo', 'Hb electrophoresis', 'D dimer', 'PNH screening'
);

UPDATE "LabTest" SET "category" = 'KIDNEY_ELECTROLYTES' WHERE "name" IN (
  'Electrolyte', 'Electrolyte + Bicarbonate', 'Urea', 'Creatinine', 'Creatinine / eGFR', 'Uric acid',
  'Ca', 'Corrected calcium', 'Phosphate', 'Mg', 'Potassium'
);

UPDATE "LabTest" SET "category" = 'THYROID_HORMONE' WHERE "name" IN (
  'FT3', 'FT4', 'Total TFT', 'TSH'
);

UPDATE "LabTest" SET "category" = 'URINE_STOOL' WHERE "name" IN (
  'Urinalysis', 'T&DP'
);

UPDATE "LabTest" SET "category" = 'WOMENS_HEALTH' WHERE "name" IN (
  'AN care (BCRD, GP, Hb%, RBS, URE)'
);

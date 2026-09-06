-- Reassign existing Receptionist/Pharmacist/Lab Tech users to the new
-- consolidated Staff role before removing the old enum values below.
UPDATE "User" SET "role" = 'STAFF' WHERE "role" IN ('RECEPTIONIST', 'PHARMACIST', 'LAB_TECH');

-- Recreate the Role enum without the retired values (Postgres has no
-- ALTER TYPE ... DROP VALUE, so swap in a new type).
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('ADMIN', 'DOCTOR', 'STAFF', 'PATIENT');
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "Role_old";
COMMIT;

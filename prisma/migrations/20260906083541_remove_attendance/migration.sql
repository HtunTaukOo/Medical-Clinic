/*
  Warnings:

  - You are about to drop the `AttendanceRecord` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "AttendanceRecord" DROP CONSTRAINT "AttendanceRecord_userId_fkey";

-- DropTable
DROP TABLE "AttendanceRecord";

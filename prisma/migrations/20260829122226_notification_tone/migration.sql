-- CreateEnum
CREATE TYPE "NotificationTone" AS ENUM ('INFO', 'SUCCESS', 'WARNING');

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "tone" "NotificationTone" NOT NULL DEFAULT 'INFO';

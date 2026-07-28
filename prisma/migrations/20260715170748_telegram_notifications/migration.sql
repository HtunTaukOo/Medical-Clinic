-- AlterTable
ALTER TABLE "ClinicSettings" ADD COLUMN     "staffTelegramChatId" TEXT;

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "telegramChatId" TEXT;

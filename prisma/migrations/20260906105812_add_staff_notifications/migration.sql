-- CreateEnum
CREATE TYPE "StaffNotificationCategory" AS ENUM ('APPOINTMENT', 'LAB_RESULT', 'INVENTORY', 'ANNOUNCEMENT');

-- CreateTable
CREATE TABLE "StaffNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "StaffNotificationCategory" NOT NULL,
    "tone" "NotificationTone" NOT NULL DEFAULT 'INFO',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT,
    "relatedId" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffNotification_userId_read_idx" ON "StaffNotification"("userId", "read");

-- CreateIndex
CREATE INDEX "StaffNotification_userId_category_idx" ON "StaffNotification"("userId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "StaffNotification_userId_relatedId_key" ON "StaffNotification"("userId", "relatedId");

-- AddForeignKey
ALTER TABLE "StaffNotification" ADD CONSTRAINT "StaffNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

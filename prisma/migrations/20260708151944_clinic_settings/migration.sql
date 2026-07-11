-- CreateTable
CREATE TABLE "ClinicSettings" (
    "id" TEXT NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "openingTime" TEXT NOT NULL DEFAULT '09:00',
    "closingTime" TEXT NOT NULL DEFAULT '17:00',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicSettings_pkey" PRIMARY KEY ("id")
);

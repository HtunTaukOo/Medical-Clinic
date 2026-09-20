-- CreateTable
CREATE TABLE "StaffPermission" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,
    "updatedByName" TEXT,

    CONSTRAINT "StaffPermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffPermission_key_key" ON "StaffPermission"("key");


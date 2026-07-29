-- CreateTable
CREATE TABLE "TelegramChatMessage" (
    "id" TEXT NOT NULL,
    "staffMessageId" INTEGER NOT NULL,
    "patientId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TelegramChatMessage_staffMessageId_key" ON "TelegramChatMessage"("staffMessageId");

-- AddForeignKey
ALTER TABLE "TelegramChatMessage" ADD CONSTRAINT "TelegramChatMessage_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

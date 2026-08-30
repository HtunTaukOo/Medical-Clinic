-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "bpDiastolic" INTEGER,
ADD COLUMN     "bpSystolic" INTEGER,
ADD COLUMN     "heartRateBpm" INTEGER,
ADD COLUMN     "respiratoryRate" INTEGER,
ADD COLUMN     "spo2Percent" INTEGER,
ADD COLUMN     "temperatureC" DECIMAL(4,1);

-- AlterTable
ALTER TABLE "DoctorProfile" ADD COLUMN     "notifyAnnouncements" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyLabResults" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyNewAppointments" BOOLEAN NOT NULL DEFAULT true;

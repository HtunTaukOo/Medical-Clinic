import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash("password123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@nca.clinic" },
    update: {},
    create: {
      email: "admin@nca.clinic",
      passwordHash: password,
      name: "NCA Admin",
      role: "ADMIN",
    },
  });

  const doctorUser = await prisma.user.upsert({
    where: { email: "doctor@nca.clinic" },
    update: {},
    create: {
      email: "doctor@nca.clinic",
      passwordHash: password,
      name: "Dr. Nyein Chan Aung",
      role: "DOCTOR",
      doctorProfile: { create: { specialty: "General Medicine" } },
    },
  });

  const receptionist = await prisma.user.upsert({
    where: { email: "receptionist@nca.clinic" },
    update: {},
    create: {
      email: "receptionist@nca.clinic",
      passwordHash: password,
      name: "Front Desk",
      role: "RECEPTIONIST",
    },
  });

  const pharmacist = await prisma.user.upsert({
    where: { email: "pharmacist@nca.clinic" },
    update: {},
    create: {
      email: "pharmacist@nca.clinic",
      passwordHash: password,
      name: "Pharmacy Staff",
      role: "PHARMACIST",
    },
  });

  const patientUser = await prisma.user.upsert({
    where: { email: "patient@example.com" },
    update: {},
    create: {
      email: "patient@example.com",
      passwordHash: password,
      name: "Sample Patient",
      role: "PATIENT",
      patient: {
        create: {
          name: "Sample Patient",
          email: "patient@example.com",
          phone: "09-123456789",
          address: "Yangon, Myanmar",
        },
      },
    },
  });

  await prisma.clinicSettings.upsert({
    where: { id: "clinic-settings" },
    update: {},
    create: {
      id: "clinic-settings",
      isOpen: true,
      openingTime: "09:00",
      closingTime: "17:00",
    },
  });

  await prisma.medicine.upsert({
    where: { id: "seed-medicine-paracetamol" },
    update: {},
    create: {
      id: "seed-medicine-paracetamol",
      name: "Paracetamol 500mg",
      unit: "tablet",
      stockQty: 200,
      reorderLevel: 50,
      price: 100,
    },
  });

  console.log({
    admin: admin.email,
    doctor: doctorUser.email,
    receptionist: receptionist.email,
    pharmacist: pharmacist.email,
    patient: patientUser.email,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

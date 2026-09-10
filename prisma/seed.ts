import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function daysAgo(n: number, hour = 10, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function daysFromNow(n: number, hour = 10, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function monthsAgo(n: number, day = 1) {
  const d = new Date();
  d.setMonth(d.getMonth() - n, day);
  d.setHours(12, 0, 0, 0);
  return d;
}

async function main() {
  const password = await bcrypt.hash("password123", 10);

  // ---------------------------------------------------------------------
  // Accounts: admin, staff, and a doctor per specialty
  // ---------------------------------------------------------------------
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
      doctorProfile: {
        create: {
          specialty: "General Medicine",
          consultationFee: 15000,
          workingDays: [1, 2, 3, 4, 5],
          workStartTime: "08:00",
          workEndTime: "17:00",
          experienceYears: 12,
          qualifications: "MBBS, MMedSc (Internal Medicine)",
          languages: ["Burmese", "English"],
          professionalBio: "General physician focused on preventive care and chronic disease management.",
          clinicRoom: "Room 101",
          gender: "MALE",
          phone: "09-450123456",
        },
      },
    },
  });

  const cardiologistUser = await prisma.user.upsert({
    where: { email: "cardiologist@nca.clinic" },
    update: {},
    create: {
      email: "cardiologist@nca.clinic",
      passwordHash: password,
      name: "Dr. Su Su Hlaing",
      role: "DOCTOR",
      doctorProfile: {
        create: {
          specialty: "Cardiology",
          consultationFee: 35000,
          workingDays: [1, 2, 3, 4, 5],
          workStartTime: "09:00",
          workEndTime: "16:00",
          experienceYears: 18,
          qualifications: "MBBS, MD (Cardiology)",
          languages: ["Burmese", "English"],
          professionalBio: "Cardiologist specializing in hypertension and heart disease management.",
          clinicRoom: "Room 204",
          gender: "FEMALE",
          phone: "09-450223344",
        },
      },
    },
  });

  const pediatricianUser = await prisma.user.upsert({
    where: { email: "pediatrician@nca.clinic" },
    update: {},
    create: {
      email: "pediatrician@nca.clinic",
      passwordHash: password,
      name: "Dr. Kyaw Zin Thant",
      role: "DOCTOR",
      doctorProfile: {
        create: {
          specialty: "Pediatrics",
          consultationFee: 20000,
          workingDays: [1, 2, 3, 4, 5, 6],
          workStartTime: "08:30",
          workEndTime: "15:30",
          experienceYears: 9,
          qualifications: "MBBS, Dip.Child Health",
          languages: ["Burmese", "English"],
          professionalBio: "Pediatrician caring for infants, children, and adolescents.",
          clinicRoom: "Room 105",
          gender: "MALE",
          phone: "09-450334455",
        },
      },
    },
  });

  const dermatologistUser = await prisma.user.upsert({
    where: { email: "dermatologist@nca.clinic" },
    update: {},
    create: {
      email: "dermatologist@nca.clinic",
      passwordHash: password,
      name: "Dr. Hnin Wutyi",
      role: "DOCTOR",
      doctorProfile: {
        create: {
          specialty: "Dermatology",
          consultationFee: 25000,
          workingDays: [2, 3, 4, 5, 6],
          workStartTime: "10:00",
          workEndTime: "18:00",
          experienceYears: 7,
          qualifications: "MBBS, Dip.Derm",
          languages: ["Burmese", "English"],
          professionalBio: "Dermatologist treating skin, hair, and nail conditions.",
          clinicRoom: "Room 210",
          gender: "FEMALE",
          phone: "09-450445566",
        },
      },
    },
  });

  // Backing doctor for the "Lab Visit" book-by-service specialty — a real
  // Appointment.doctorId is still required even though patients book by
  // service/capacity rather than picking this doctor directly.
  const labDoctorUser = await prisma.user.upsert({
    where: { email: "labdoctor@nca.clinic" },
    update: {},
    create: {
      email: "labdoctor@nca.clinic",
      passwordHash: password,
      name: "Dr. Lab Services",
      role: "DOCTOR",
      doctorProfile: {
        create: {
          specialty: "Lab Visit",
          consultationFee: 0,
          workingDays: [1, 2, 3, 4, 5, 6],
          workStartTime: "08:00",
          workEndTime: "17:00",
          experienceYears: 5,
          qualifications: "MBBS, Dip.Clin.Path",
        },
      },
    },
  });

  const receptionist = await prisma.user.upsert({
    where: { email: "receptionist@nca.clinic" },
    update: { title: "Receptionist" },
    create: {
      email: "receptionist@nca.clinic",
      passwordHash: password,
      name: "Front Desk",
      role: "STAFF",
      title: "Receptionist",
    },
  });

  const pharmacist = await prisma.user.upsert({
    where: { email: "pharmacist@nca.clinic" },
    update: { title: "Pharmacist" },
    create: {
      email: "pharmacist@nca.clinic",
      passwordHash: password,
      name: "Pharmacy Staff",
      role: "STAFF",
      title: "Pharmacist",
    },
  });

  const labTech = await prisma.user.upsert({
    where: { email: "lab@nca.clinic" },
    update: { title: "Lab Technician" },
    create: {
      email: "lab@nca.clinic",
      passwordHash: password,
      name: "Lab Technician",
      role: "STAFF",
      title: "Lab Technician",
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
          gender: "MALE",
          dob: new Date("1990-05-14"),
        },
      },
    },
  });

  // ---------------------------------------------------------------------
  // Clinic settings & specialties
  // ---------------------------------------------------------------------
  await prisma.clinicSettings.upsert({
    where: { id: "clinic-settings" },
    update: {},
    create: {
      id: "clinic-settings",
      name: "NCA Clinic",
      email: "contact@nca.clinic",
      phones: ["09-450100200"],
      address: "No. 12, Kabar Aye Pagoda Road, Yangon, Myanmar",
    },
  });

  const specialties = [
    { name: "General Medicine", icon: "Stethoscope", description: "Check-ups, fever, cough, general health" },
    { name: "Cardiology", icon: "HeartPulse", description: "Heart health, blood pressure, chest pain" },
    { name: "Pediatrics", icon: "Baby", description: "Children's health, vaccinations, growth" },
    { name: "Dermatology", icon: "Sparkles", description: "Skin, hair, nail conditions & cosmetic" },
    { name: "Orthopedics", icon: "Bone", description: "Joints, bones, muscles, sports injuries" },
    { name: "ENT", icon: "Ear", description: "Ear, nose, throat, sinuses & voice" },
    { name: "Obs & Gynecology", icon: "Venus", description: "Maternal health, women's wellness" },
    { name: "Ophthalmology", icon: "Eye", description: "Vision, eye disease, glasses & surgery" },
    {
      name: "Lab Visit",
      icon: "TestTube",
      description: "Blood work and sample collection — no doctor visit needed",
      bookByService: true,
      capacityPerSlot: 3,
    },
  ];
  for (const [i, s] of specialties.entries()) {
    await prisma.specialty.upsert({
      where: { name: s.name },
      update: {},
      create: { ...s, sortOrder: i },
    });
  }

  // ---------------------------------------------------------------------
  // Clinic services
  // ---------------------------------------------------------------------
  const clinicServices = [
    { id: "seed-service-general-consult", name: "General Consultation", specialty: "General Medicine", durationMinutes: 30, price: 15000, room: "Room 101" },
    { id: "seed-service-ecg", name: "ECG", specialty: "Cardiology", durationMinutes: 20, price: 25000, room: "Room 204" },
    { id: "seed-service-child-wellness", name: "Child Wellness Checkup", specialty: "Pediatrics", durationMinutes: 30, price: 18000, room: "Room 105" },
    { id: "seed-service-skin-consult", name: "Skin Consultation", specialty: "Dermatology", durationMinutes: 20, price: 20000, room: "Room 210" },
    { id: "seed-service-cbc-panel", name: "Blood Test - CBC Panel", specialty: "Lab Visit", durationMinutes: 15, price: 8000 },
    { id: "seed-service-urinalysis", name: "Urinalysis", specialty: "Lab Visit", durationMinutes: 15, price: 6000 },
  ];
  for (const service of clinicServices) {
    await prisma.clinicService.upsert({
      where: { id: service.id },
      update: {},
      create: service,
    });
  }
  const labCbcService = clinicServices.find((s) => s.id === "seed-service-cbc-panel")!;

  // ---------------------------------------------------------------------
  // Patients (beyond the login-enabled Sample Patient)
  // ---------------------------------------------------------------------
  const patientSeeds = [
    {
      id: "seed-patient-aye-aye-win",
      name: "Aye Aye Win",
      email: "ayeayewin@example.com",
      phone: "09-234567890",
      address: "Bahan, Yangon",
      gender: "FEMALE" as const,
      dob: new Date("1985-03-22"),
      bloodType: "O+",
      insuranceProvider: "Grand Guardian Insurance",
      insurancePolicyNumber: "GGI-88213",
    },
    {
      id: "seed-patient-zaw-zaw-htun",
      name: "Zaw Zaw Htun",
      email: "zawzawhtun@example.com",
      phone: "09-234567891",
      address: "Sanchaung, Yangon",
      gender: "MALE" as const,
      dob: new Date("1978-11-02"),
      bloodType: "A+",
      insuranceProvider: "AYA Sompo Insurance",
      insurancePolicyNumber: "ASI-44720",
    },
    {
      id: "seed-patient-thandar-oo",
      name: "Thandar Oo",
      email: "thandaroo@example.com",
      phone: "09-234567892",
      address: "Hlaing, Yangon",
      gender: "FEMALE" as const,
      dob: new Date("1996-07-19"),
      bloodType: "B+",
    },
    {
      id: "seed-patient-min-min-aung",
      name: "Min Min Aung",
      email: "minminaung@example.com",
      phone: "09-234567893",
      address: "Mayangone, Yangon",
      gender: "MALE" as const,
      dob: new Date("2015-01-30"),
      bloodType: "AB+",
    },
  ];
  for (const p of patientSeeds) {
    await prisma.patient.upsert({
      where: { id: p.id },
      update: {},
      create: p,
    });
  }
  const [patientSample, patientAye, patientZaw, patientThandar, patientMin] = await Promise.all([
    prisma.patient.findUniqueOrThrow({ where: { userId: patientUser.id } }),
    prisma.patient.findUniqueOrThrow({ where: { id: "seed-patient-aye-aye-win" } }),
    prisma.patient.findUniqueOrThrow({ where: { id: "seed-patient-zaw-zaw-htun" } }),
    prisma.patient.findUniqueOrThrow({ where: { id: "seed-patient-thandar-oo" } }),
    prisma.patient.findUniqueOrThrow({ where: { id: "seed-patient-min-min-aung" } }),
  ]);

  await prisma.allergy.upsert({
    where: { id: "seed-allergy-aye-penicillin" },
    update: {},
    create: {
      id: "seed-allergy-aye-penicillin",
      patientId: patientAye.id,
      name: "Penicillin",
      category: "DRUG",
      reaction: "Rash and swelling",
      severity: "SEVERE",
      firstNoted: monthsAgo(24),
    },
  });
  await prisma.allergy.upsert({
    where: { id: "seed-allergy-thandar-peanuts" },
    update: {},
    create: {
      id: "seed-allergy-thandar-peanuts",
      patientId: patientThandar.id,
      name: "Peanuts",
      category: "FOOD",
      reaction: "Hives",
      severity: "MODERATE",
      firstNoted: monthsAgo(36),
    },
  });

  // ---------------------------------------------------------------------
  // Medicines — a mix of healthy stock, low stock, expiring, and expired
  // ---------------------------------------------------------------------
  const medicines = [
    { id: "seed-medicine-paracetamol", name: "Paracetamol 500mg", unit: "tablet", stockQty: 200, reorderLevel: 50, price: 100 },
    { id: "seed-medicine-amoxicillin", name: "Amoxicillin 500mg", unit: "capsule", stockQty: 150, reorderLevel: 40, price: 250 },
    { id: "seed-medicine-ibuprofen", name: "Ibuprofen 200mg", unit: "tablet", stockQty: 15, reorderLevel: 50, price: 120 },
    { id: "seed-medicine-cetirizine", name: "Cetirizine 10mg", unit: "tablet", stockQty: 180, reorderLevel: 30, price: 80 },
    { id: "seed-medicine-omeprazole", name: "Omeprazole 20mg", unit: "capsule", stockQty: 90, reorderLevel: 25, price: 200, expiryDate: daysFromNow(20) },
    { id: "seed-medicine-metformin", name: "Metformin 500mg", unit: "tablet", stockQty: 60, reorderLevel: 30, price: 150, expiryDate: daysAgo(10) },
    { id: "seed-medicine-amlodipine", name: "Amlodipine 5mg", unit: "tablet", stockQty: 120, reorderLevel: 30, price: 180 },
    { id: "seed-medicine-salbutamol", name: "Salbutamol Inhaler", unit: "inhaler", stockQty: 25, reorderLevel: 10, price: 4500 },
    { id: "seed-medicine-ors", name: "ORS Sachets", unit: "sachet", stockQty: 300, reorderLevel: 100, price: 50 },
  ];
  for (const m of medicines) {
    await prisma.medicine.upsert({ where: { id: m.id }, update: {}, create: m });
  }

  // ---------------------------------------------------------------------
  // Lab tests
  // ---------------------------------------------------------------------
  const labTests = [
    { id: "seed-labtest-cbc", name: "Complete Blood Count (CBC)", unit: "cells/mcL", normalRange: "4,500–11,000", price: 8000 },
    { id: "seed-labtest-fbs", name: "Fasting Blood Sugar", unit: "mg/dL", normalRange: "70–100", price: 6000 },
    { id: "seed-labtest-lipid", name: "Lipid Profile", unit: "mg/dL", normalRange: "<200 total cholesterol", price: 15000 },
    { id: "seed-labtest-lft", name: "Liver Function Test", unit: "U/L", normalRange: "7–56", price: 18000 },
    { id: "seed-labtest-urinalysis", name: "Urinalysis", unit: "-", normalRange: "Normal", price: 6000 },
  ];
  for (const t of labTests) {
    await prisma.labTest.upsert({ where: { id: t.id }, update: {}, create: t });
  }

  // ---------------------------------------------------------------------
  // Suppliers & purchase orders
  // ---------------------------------------------------------------------
  const supplier1 = await prisma.supplier.upsert({
    where: { id: "seed-supplier-medisupply" },
    update: {},
    create: {
      id: "seed-supplier-medisupply",
      name: "MediSupply Myanmar",
      contactName: "Ko Thura",
      phone: "01-2301234",
      email: "sales@medisupply.mm",
      address: "Industrial Zone 2, Yangon",
    },
  });
  const supplier2 = await prisma.supplier.upsert({
    where: { id: "seed-supplier-golden-pharma" },
    update: {},
    create: {
      id: "seed-supplier-golden-pharma",
      name: "Golden Pharma Distributors",
      contactName: "Daw Khin Mar",
      phone: "01-2305678",
      email: "orders@goldenpharma.mm",
      address: "Bayint Naung Road, Yangon",
    },
  });

  const po1 = await prisma.purchaseOrder.upsert({
    where: { id: "seed-po-ibuprofen-order" },
    update: {},
    create: {
      id: "seed-po-ibuprofen-order",
      supplierId: supplier1.id,
      status: "ORDERED",
      notes: "Restocking low ibuprofen supply",
      createdById: pharmacist.id,
    },
  });
  await prisma.purchaseOrderItem.upsert({
    where: { id: "seed-poi-ibuprofen" },
    update: {},
    create: {
      id: "seed-poi-ibuprofen",
      purchaseOrderId: po1.id,
      medicineId: "seed-medicine-ibuprofen",
      quantity: 200,
      unitCost: 60,
      receivedQty: 0,
    },
  });

  const po2 = await prisma.purchaseOrder.upsert({
    where: { id: "seed-po-amoxicillin-order" },
    update: {},
    create: {
      id: "seed-po-amoxicillin-order",
      supplierId: supplier2.id,
      status: "PARTIALLY_RECEIVED",
      createdById: pharmacist.id,
    },
  });
  await prisma.purchaseOrderItem.upsert({
    where: { id: "seed-poi-amoxicillin" },
    update: {},
    create: {
      id: "seed-poi-amoxicillin",
      purchaseOrderId: po2.id,
      medicineId: "seed-medicine-amoxicillin",
      quantity: 200,
      unitCost: 130,
      receivedQty: 100,
    },
  });

  const po3 = await prisma.purchaseOrder.upsert({
    where: { id: "seed-po-cetirizine-order" },
    update: {},
    create: {
      id: "seed-po-cetirizine-order",
      supplierId: supplier1.id,
      status: "RECEIVED",
      createdById: pharmacist.id,
    },
  });
  await prisma.purchaseOrderItem.upsert({
    where: { id: "seed-poi-cetirizine" },
    update: {},
    create: {
      id: "seed-poi-cetirizine",
      purchaseOrderId: po3.id,
      medicineId: "seed-medicine-cetirizine",
      quantity: 150,
      unitCost: 40,
      receivedQty: 150,
    },
  });

  // ---------------------------------------------------------------------
  // Billing packages
  // ---------------------------------------------------------------------
  const packages = [
    { id: "seed-package-full-checkup", name: "Full Health Checkup", description: "Consultation, CBC, and lipid profile", price: 45000 },
    { id: "seed-package-diabetes-screening", name: "Diabetes Screening Package", description: "Consultation and fasting blood sugar test", price: 25000 },
    { id: "seed-package-executive-wellness", name: "Executive Wellness Package", description: "Full consultation, ECG, CBC, and liver function test", price: 80000 },
  ];
  for (const pkg of packages) {
    await prisma.package.upsert({ where: { id: pkg.id }, update: {}, create: pkg });
  }

  // ---------------------------------------------------------------------
  // Appointments across the full status range
  // ---------------------------------------------------------------------
  const doctorGeneral = await prisma.doctorProfile.findUniqueOrThrow({ where: { userId: doctorUser.id } });
  const doctorCardio = await prisma.doctorProfile.findUniqueOrThrow({ where: { userId: cardiologistUser.id } });
  const doctorPed = await prisma.doctorProfile.findUniqueOrThrow({ where: { userId: pediatricianUser.id } });
  const doctorDerm = await prisma.doctorProfile.findUniqueOrThrow({ where: { userId: dermatologistUser.id } });
  const doctorLab = await prisma.doctorProfile.findUniqueOrThrow({ where: { userId: labDoctorUser.id } });

  const completedAppt1 = await prisma.appointment.upsert({
    where: { id: "seed-appt-completed-1" },
    update: {},
    create: {
      id: "seed-appt-completed-1",
      patientId: patientSample.id,
      doctorId: doctorGeneral.id,
      scheduledAt: daysAgo(30, 9, 30),
      status: "COMPLETED",
      reason: "Fever and cough",
      chiefComplaint: "3 days of fever, cough, and sore throat",
      treatmentPlan: "Rest, fluids, and a 5-day course of antibiotics",
    },
  });

  const completedAppt2 = await prisma.appointment.upsert({
    where: { id: "seed-appt-completed-2" },
    update: {},
    create: {
      id: "seed-appt-completed-2",
      patientId: patientAye.id,
      doctorId: doctorCardio.id,
      scheduledAt: daysAgo(20, 11, 0),
      status: "COMPLETED",
      reason: "Follow-up for hypertension",
      clinicServiceId: "seed-service-ecg",
      chiefComplaint: "Routine hypertension follow-up, occasional headaches",
      treatmentPlan: "Continue amlodipine, repeat ECG in 3 months",
      bpSystolic: 138,
      bpDiastolic: 88,
      heartRateBpm: 76,
    },
  });

  const completedAppt3 = await prisma.appointment.upsert({
    where: { id: "seed-appt-completed-3" },
    update: {},
    create: {
      id: "seed-appt-completed-3",
      patientId: patientZaw.id,
      doctorId: doctorGeneral.id,
      scheduledAt: daysAgo(10, 14, 0),
      status: "COMPLETED",
      reason: "Annual checkup",
      chiefComplaint: "Routine annual physical",
      treatmentPlan: "Bloodwork ordered, review results at next visit",
    },
  });

  await prisma.appointment.upsert({
    where: { id: "seed-appt-confirmed-today" },
    update: {},
    create: {
      id: "seed-appt-confirmed-today",
      patientId: patientThandar.id,
      doctorId: doctorGeneral.id,
      scheduledAt: daysFromNow(0, 15, 0),
      status: "CONFIRMED",
      reason: "General consultation",
      clinicServiceId: "seed-service-general-consult",
    },
  });

  await prisma.appointment.upsert({
    where: { id: "seed-appt-checkedin-today" },
    update: {},
    create: {
      id: "seed-appt-checkedin-today",
      patientId: patientMin.id,
      doctorId: doctorPed.id,
      scheduledAt: daysFromNow(0, 10, 0),
      status: "CHECKED_IN",
      checkedInAt: new Date(),
      reason: "Vaccination and growth checkup",
      clinicServiceId: "seed-service-child-wellness",
    },
  });

  await prisma.appointment.upsert({
    where: { id: "seed-appt-requested-future" },
    update: {},
    create: {
      id: "seed-appt-requested-future",
      patientId: patientSample.id,
      doctorId: doctorPed.id,
      scheduledAt: daysFromNow(3, 13, 0),
      status: "REQUESTED",
      reason: "Growth checkup for child",
    },
  });

  await prisma.appointment.upsert({
    where: { id: "seed-appt-cancelled" },
    update: {},
    create: {
      id: "seed-appt-cancelled",
      patientId: patientAye.id,
      doctorId: doctorDerm.id,
      scheduledAt: daysAgo(5, 16, 0),
      status: "CANCELLED",
      reason: "Skin rash consultation",
    },
  });

  await prisma.appointment.upsert({
    where: { id: "seed-appt-noshow" },
    update: {},
    create: {
      id: "seed-appt-noshow",
      patientId: patientZaw.id,
      doctorId: doctorGeneral.id,
      scheduledAt: daysAgo(7, 9, 0),
      status: "NO_SHOW",
      reason: "General consultation",
    },
  });

  await prisma.appointment.upsert({
    where: { id: "seed-appt-lab-visit" },
    update: {},
    create: {
      id: "seed-appt-lab-visit",
      patientId: patientThandar.id,
      doctorId: doctorLab.id,
      scheduledAt: daysFromNow(2, 9, 0),
      durationMinutes: labCbcService.durationMinutes,
      status: "CONFIRMED",
      reason: labCbcService.name,
      clinicServiceId: labCbcService.id,
    },
  });

  // ---------------------------------------------------------------------
  // Diagnoses & prescriptions for the completed visits
  // ---------------------------------------------------------------------
  await prisma.diagnosis.upsert({
    where: { id: "seed-diagnosis-1" },
    update: {},
    create: {
      id: "seed-diagnosis-1",
      appointmentId: completedAppt1.id,
      patientId: patientSample.id,
      doctorId: doctorGeneral.id,
      code: "J06.9",
      description: "Acute upper respiratory infection",
      status: "RESOLVED",
      severity: "MILD",
    },
  });
  await prisma.diagnosis.upsert({
    where: { id: "seed-diagnosis-2" },
    update: {},
    create: {
      id: "seed-diagnosis-2",
      appointmentId: completedAppt2.id,
      patientId: patientAye.id,
      doctorId: doctorCardio.id,
      code: "I10",
      description: "Essential (primary) hypertension",
      status: "ACTIVE",
      severity: "MODERATE",
    },
  });

  const prescription1 = await prisma.prescription.upsert({
    where: { id: "seed-prescription-1" },
    update: {},
    create: {
      id: "seed-prescription-1",
      appointmentId: completedAppt1.id,
      patientId: patientSample.id,
      doctorId: doctorGeneral.id,
      fulfilled: true,
      fulfilledAt: daysAgo(30, 10, 0),
    },
  });
  await prisma.prescriptionItem.upsert({
    where: { id: "seed-rxitem-1" },
    update: {},
    create: {
      id: "seed-rxitem-1",
      prescriptionId: prescription1.id,
      medicineId: "seed-medicine-amoxicillin",
      dosage: "500mg",
      quantity: 15,
      timesPerDay: 3,
      durationDays: 5,
      instructions: "Take after meals",
    },
  });
  await prisma.prescriptionItem.upsert({
    where: { id: "seed-rxitem-2" },
    update: {},
    create: {
      id: "seed-rxitem-2",
      prescriptionId: prescription1.id,
      medicineId: "seed-medicine-paracetamol",
      dosage: "500mg",
      quantity: 10,
      timesPerDay: 2,
      durationDays: 5,
      instructions: "Take as needed for fever",
    },
  });

  const prescription2 = await prisma.prescription.upsert({
    where: { id: "seed-prescription-2" },
    update: {},
    create: {
      id: "seed-prescription-2",
      appointmentId: completedAppt2.id,
      patientId: patientAye.id,
      doctorId: doctorCardio.id,
      fulfilled: false,
    },
  });
  await prisma.prescriptionItem.upsert({
    where: { id: "seed-rxitem-3" },
    update: {},
    create: {
      id: "seed-rxitem-3",
      prescriptionId: prescription2.id,
      medicineId: "seed-medicine-amlodipine",
      dosage: "5mg",
      quantity: 30,
      timesPerDay: 1,
      durationDays: 30,
      instructions: "Take once daily in the morning",
      refillsLeft: 2,
    },
  });

  // ---------------------------------------------------------------------
  // Invoices, payments, and insurance claims
  // ---------------------------------------------------------------------
  const invoice1 = await prisma.invoice.upsert({
    where: { id: "seed-invoice-1" },
    update: {},
    create: {
      id: "seed-invoice-1",
      patientId: patientSample.id,
      appointmentId: completedAppt1.id,
      status: "PAID",
      total: 30000,
      items: {
        create: [
          { description: "Consultation Fee", quantity: 1, unitPrice: 15000 },
          { description: "Medicine Charges", quantity: 1, unitPrice: 15000 },
        ],
      },
    },
  });
  await prisma.payment.upsert({
    where: { id: "seed-payment-1" },
    update: {},
    create: {
      id: "seed-payment-1",
      invoiceId: invoice1.id,
      amount: 30000,
      method: "CASH",
      paidAt: daysAgo(30, 10, 30),
    },
  });

  const invoice2 = await prisma.invoice.upsert({
    where: { id: "seed-invoice-2" },
    update: {},
    create: {
      id: "seed-invoice-2",
      patientId: patientAye.id,
      appointmentId: completedAppt2.id,
      status: "PARTIAL",
      total: 100000,
      items: {
        create: [
          { description: "Consultation Fee", quantity: 1, unitPrice: 35000 },
          { description: "ECG", quantity: 1, unitPrice: 25000, clinicServiceId: "seed-service-ecg" },
          { description: "Medicine Charges", quantity: 1, unitPrice: 40000 },
        ],
      },
    },
  });
  const insurancePayment2 = await prisma.payment.upsert({
    where: { id: "seed-payment-2-insurance" },
    update: {},
    create: {
      id: "seed-payment-2-insurance",
      invoiceId: invoice2.id,
      amount: 80000,
      method: "INSURANCE",
      paidAt: daysAgo(18, 12, 0),
    },
  });
  await prisma.insuranceClaim.upsert({
    where: { id: "seed-claim-approved" },
    update: {},
    create: {
      id: "seed-claim-approved",
      invoiceId: invoice2.id,
      patientId: patientAye.id,
      insuranceProvider: "Grand Guardian Insurance",
      policyNumber: patientAye.insurancePolicyNumber ?? "GGI-88213",
      claimedAmount: 100000,
      approvedAmount: 80000,
      status: "PAID",
      paymentId: insurancePayment2.id,
      submittedAt: daysAgo(19),
    },
  });

  const invoice3 = await prisma.invoice.upsert({
    where: { id: "seed-invoice-3" },
    update: {},
    create: {
      id: "seed-invoice-3",
      patientId: patientZaw.id,
      appointmentId: completedAppt3.id,
      status: "UNPAID",
      total: 45000,
      items: {
        create: [
          { description: "Consultation Fee", quantity: 1, unitPrice: 15000 },
          { description: "Lab / Service Charges", quantity: 1, unitPrice: 30000 },
        ],
      },
    },
  });
  await prisma.insuranceClaim.upsert({
    where: { id: "seed-claim-rejected" },
    update: {},
    create: {
      id: "seed-claim-rejected",
      invoiceId: invoice3.id,
      patientId: patientZaw.id,
      insuranceProvider: "AYA Sompo Insurance",
      policyNumber: patientZaw.insurancePolicyNumber ?? "ASI-44720",
      claimedAmount: 45000,
      status: "REJECTED",
      notes: "Pre-existing condition exclusion",
      submittedAt: daysAgo(9),
    },
  });

  // ---------------------------------------------------------------------
  // Expenses — spread over the last 5 months for the profit trend chart
  // ---------------------------------------------------------------------
  for (let i = 0; i < 5; i++) {
    await prisma.expense.upsert({
      where: { id: `seed-expense-rent-${i}` },
      update: {},
      create: {
        id: `seed-expense-rent-${i}`,
        category: "RENT",
        description: "Clinic rent",
        amount: 800000,
        vendor: "Landlord",
        paidAt: monthsAgo(i, 1),
        recordedById: admin.id,
      },
    });
    await prisma.expense.upsert({
      where: { id: `seed-expense-utilities-${i}` },
      update: {},
      create: {
        id: `seed-expense-utilities-${i}`,
        category: "UTILITIES",
        description: "Electricity and water",
        amount: 120000 + i * 5000,
        vendor: "Yangon Electricity Supply Corp",
        paidAt: monthsAgo(i, 5),
        recordedById: admin.id,
      },
    });
    await prisma.expense.upsert({
      where: { id: `seed-expense-salaries-${i}` },
      update: {},
      create: {
        id: `seed-expense-salaries-${i}`,
        category: "SALARIES",
        description: "Staff salaries",
        amount: 2500000,
        paidAt: monthsAgo(i, 28),
        recordedById: admin.id,
      },
    });
  }
  await prisma.expense.upsert({
    where: { id: "seed-expense-supplies-1" },
    update: {},
    create: {
      id: "seed-expense-supplies-1",
      category: "SUPPLIES",
      description: "Medical consumables restock",
      amount: 350000,
      vendor: "MediSupply Myanmar",
      paidAt: daysAgo(12),
      recordedById: admin.id,
    },
  });
  await prisma.expense.upsert({
    where: { id: "seed-expense-marketing-1" },
    update: {},
    create: {
      id: "seed-expense-marketing-1",
      category: "MARKETING",
      description: "Social media ad campaign",
      amount: 150000,
      paidAt: daysAgo(25),
      recordedById: admin.id,
    },
  });
  await prisma.expense.upsert({
    where: { id: "seed-expense-maintenance-1" },
    update: {},
    create: {
      id: "seed-expense-maintenance-1",
      category: "MAINTENANCE",
      description: "AC servicing",
      amount: 80000,
      paidAt: daysAgo(6),
      recordedById: admin.id,
    },
  });

  // ---------------------------------------------------------------------
  // Announcements
  // ---------------------------------------------------------------------
  await prisma.announcement.upsert({
    where: { id: "seed-announcement-1" },
    update: {},
    create: {
      id: "seed-announcement-1",
      title: "Extended Saturday Hours",
      body: "We now see patients until 2 PM on Saturdays. Book your weekend appointment today.",
      category: "General",
      authorId: admin.id,
    },
  });
  await prisma.announcement.upsert({
    where: { id: "seed-announcement-2" },
    update: {},
    create: {
      id: "seed-announcement-2",
      title: "Flu Vaccination Drive",
      body: "Seasonal flu vaccines are now available. Ask your doctor or the front desk to book a slot.",
      category: "Health",
      authorId: admin.id,
    },
  });

  console.log({
    admin: admin.email,
    doctors: [doctorUser.email, cardiologistUser.email, pediatricianUser.email, dermatologistUser.email, labDoctorUser.email],
    receptionist: receptionist.email,
    pharmacist: pharmacist.email,
    labTech: labTech.email,
    patients: [patientUser.email, patientAye.name, patientZaw.name, patientThandar.name, patientMin.name],
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

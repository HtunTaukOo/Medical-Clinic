"use server";

// TEMPORARY one-off action, backing the /staff/force-delete-doctor admin
// page. The normal deleteStaffUser (src/actions/staff.ts) refuses to delete
// a doctor with any appointment/diagnosis/prescription/lab-order/walk-in
// history — correctly, for real doctors. This exists only to force-remove
// two known TEST doctor accounts (Dr. Cho Cho Win, Dr. Aung Zaw Htet) and
// their attached history from production. DELETE this file + the page once
// that's done and verified — do not leave a "force delete a doctor" tool
// lying around in a real clinic app.
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { logActivity } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export type DoctorHistorySummary = {
  doctorProfileId: string;
  userId: string;
  name: string;
  email: string;
  specialty: string | null;
  appointmentCount: number;
  diagnosisCount: number;
  prescriptionCount: number;
  labOrderCount: number;
  walkInCount: number;
};

export async function listDoctorsWithHistory(): Promise<DoctorHistorySummary[]> {
  await requireRole(["ADMIN"]);

  const doctors = await prisma.doctorProfile.findMany({
    include: { user: true },
    orderBy: { user: { name: "asc" } },
  });

  return Promise.all(
    doctors.map(async (d) => {
      const [appointmentCount, diagnosisCount, prescriptionCount, labOrderCount, walkInCount] =
        await Promise.all([
          prisma.appointment.count({ where: { doctorId: d.id } }),
          prisma.diagnosis.count({ where: { doctorId: d.id } }),
          prisma.prescription.count({ where: { doctorId: d.id } }),
          prisma.labOrder.count({ where: { doctorId: d.id } }),
          prisma.walkIn.count({ where: { doctorId: d.id } }),
        ]);
      return {
        doctorProfileId: d.id,
        userId: d.userId,
        name: d.user.name,
        email: d.user.email,
        specialty: d.specialty,
        appointmentCount,
        diagnosisCount,
        prescriptionCount,
        labOrderCount,
        walkInCount,
      };
    })
  );
}

export type ForceDeleteResult = { error?: string; lines?: string[] };

// Deletes a doctor's entire history, then the doctor/user account itself.
// Order matters — Postgres FK constraints (mostly RESTRICT, no ON DELETE
// rule) block a row while anything still references it:
//   1. Detach (SET NULL) inbound links from tables that must NOT themselves
//      be deleted — Invoice.appointmentId, PharmacySale.prescriptionId — so
//      real billing/sales records survive, just unlinked from the removed
//      appointment/prescription.
//   2. Delete MedicineRequest rows tied to a prescription being removed
//      (a request with its prescriptionId nulled would be left in a
//      meaningless half-populated state, unlike an Invoice/PharmacySale).
//   3. Delete Diagnosis rows (required, non-nullable appointmentId — can't
//      be detached, must be removed outright).
//   4. Delete WalkIn, LabOrder (cascades LabOrderItem), Prescription
//      (cascades PrescriptionItem -> PillReminder), then Appointment.
//   5. Delete DoctorProfile (cascades DoctorShift, DoctorLeave) and User.
// All in one transaction: if anything unexpected blocks it, nothing is
// partially deleted — Prisma rolls the whole thing back.
export async function forceDeleteDoctor(doctorProfileId: string): Promise<ForceDeleteResult> {
  const session = await requireRole(["ADMIN"]);

  const doctor = await prisma.doctorProfile.findUnique({
    where: { id: doctorProfileId },
    include: { user: true },
  });
  if (!doctor) return { error: "Doctor not found." };

  const lines: string[] = [];

  try {
    await prisma.$transaction(async (tx) => {
      const appointments = await tx.appointment.findMany({
        where: { doctorId: doctorProfileId },
        select: { id: true },
      });
      const appointmentIds = appointments.map((a) => a.id);

      const prescriptions = await tx.prescription.findMany({
        where: { doctorId: doctorProfileId },
        select: { id: true },
      });
      const prescriptionIds = prescriptions.map((p) => p.id);

      if (appointmentIds.length > 0) {
        const invoiceResult = await tx.invoice.updateMany({
          where: { appointmentId: { in: appointmentIds } },
          data: { appointmentId: null },
        });
        lines.push(`Detached ${invoiceResult.count} invoice(s) from deleted appointments.`);

        await tx.walkIn.updateMany({
          where: { appointmentId: { in: appointmentIds } },
          data: { appointmentId: null },
        });
        await tx.prescription.updateMany({
          where: { appointmentId: { in: appointmentIds } },
          data: { appointmentId: null },
        });
        await tx.labOrder.updateMany({
          where: { appointmentId: { in: appointmentIds } },
          data: { appointmentId: null },
        });
      }

      if (prescriptionIds.length > 0) {
        const saleResult = await tx.pharmacySale.updateMany({
          where: { prescriptionId: { in: prescriptionIds } },
          data: { prescriptionId: null },
        });
        lines.push(`Detached ${saleResult.count} pharmacy sale(s) from deleted prescriptions.`);

        const requestResult = await tx.medicineRequest.deleteMany({
          where: { prescriptionId: { in: prescriptionIds } },
        });
        lines.push(`Deleted ${requestResult.count} medicine request(s) tied to deleted prescriptions.`);
      }

      const diagnosisResult = await tx.diagnosis.deleteMany({
        where: { OR: [{ doctorId: doctorProfileId }, { appointmentId: { in: appointmentIds } }] },
      });
      lines.push(`Deleted ${diagnosisResult.count} diagnosis(es).`);

      const walkInResult = await tx.walkIn.deleteMany({ where: { doctorId: doctorProfileId } });
      lines.push(`Deleted ${walkInResult.count} walk-in(s).`);

      const labOrderResult = await tx.labOrder.deleteMany({ where: { doctorId: doctorProfileId } });
      lines.push(`Deleted ${labOrderResult.count} lab order(s) (and their items).`);

      const prescriptionResult = await tx.prescription.deleteMany({ where: { doctorId: doctorProfileId } });
      lines.push(`Deleted ${prescriptionResult.count} prescription(s) (and their items/pill reminders).`);

      const appointmentResult = await tx.appointment.deleteMany({ where: { doctorId: doctorProfileId } });
      lines.push(`Deleted ${appointmentResult.count} appointment(s).`);

      await tx.doctorProfile.delete({ where: { id: doctorProfileId } });
      await tx.user.delete({ where: { id: doctor.userId } });
      lines.push(`Deleted doctor account: ${doctor.user.name} (${doctor.user.email}).`);
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Delete failed", lines };
  }

  await logActivity({
    actorId: session.user.id,
    actorName: session.user.name ?? session.user.email ?? "Unknown",
    actorRole: session.user.role,
    action: "Force-deleted doctor account (with history)",
    target: `${doctor.user.name} (${doctor.user.email})`,
  });

  revalidatePath("/staff/users");
  revalidatePath("/staff/doctors");
  return { lines };
}

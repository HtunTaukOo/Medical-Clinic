"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { getActiveSpecialties } from "@/lib/specialties-data";

const clinicServiceSchema = z.object({
  name: z.string().min(1),
  specialty: z.string().optional(),
  durationMinutes: z.coerce.number().int().positive(),
  price: z.coerce.number().nonnegative(),
  room: z.string().optional(),
  active: z.enum(["on", "off"]).transform((v) => v === "on"),
});

export type ClinicServiceFormState = { error?: string; success?: boolean };

async function validateSpecialty(specialty: string | undefined) {
  if (!specialty) return null;
  const specialties = await getActiveSpecialties();
  if (!specialties.some((s) => s.name === specialty)) {
    return "Invalid specialty";
  }
  return null;
}

export async function createClinicService(
  _prevState: ClinicServiceFormState,
  formData: FormData
): Promise<ClinicServiceFormState> {
  await requireRole(["ADMIN"]);

  const parsed = clinicServiceSchema.safeParse({
    name: formData.get("name"),
    specialty: formData.get("specialty") || undefined,
    durationMinutes: formData.get("durationMinutes"),
    price: formData.get("price"),
    room: formData.get("room") || undefined,
    active: formData.get("active") ? "on" : "off",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const specialtyError = await validateSpecialty(parsed.data.specialty);
  if (specialtyError) return { error: specialtyError };

  await prisma.clinicService.create({ data: parsed.data });

  revalidatePath("/staff/clinic-services");
  return { success: true };
}

export async function updateClinicService(
  serviceId: string,
  _prevState: ClinicServiceFormState,
  formData: FormData
): Promise<ClinicServiceFormState> {
  await requireRole(["ADMIN"]);

  const parsed = clinicServiceSchema.safeParse({
    name: formData.get("name"),
    specialty: formData.get("specialty") || undefined,
    durationMinutes: formData.get("durationMinutes"),
    price: formData.get("price"),
    room: formData.get("room") || undefined,
    active: formData.get("active") ? "on" : "off",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const specialtyError = await validateSpecialty(parsed.data.specialty);
  if (specialtyError) return { error: specialtyError };

  await prisma.clinicService.update({ where: { id: serviceId }, data: parsed.data });

  revalidatePath("/staff/clinic-services");
  return { success: true };
}

// Appointment.clinicServiceId and InvoiceItem.clinicServiceId both cascade to
// null on delete at the DB level, so a hard delete wouldn't error — it would
// just silently strip the service name off past appointments and invoices.
// Block it when there's history and point the admin at "Available" instead.
/* eslint-disable @typescript-eslint/no-unused-vars -- signature must match useActionState's (state, formData) */
export async function deleteClinicService(
  serviceId: string,
  _prevState: ClinicServiceFormState,
  _formData: FormData
): Promise<ClinicServiceFormState> {
  /* eslint-enable @typescript-eslint/no-unused-vars */
  await requireRole(["ADMIN"]);

  const [appointmentCount, invoiceItemCount] = await Promise.all([
    prisma.appointment.count({ where: { clinicServiceId: serviceId } }),
    prisma.invoiceItem.count({ where: { clinicServiceId: serviceId } }),
  ]);
  if (appointmentCount > 0 || invoiceItemCount > 0) {
    return {
      error: `Can't delete — this service is used by ${appointmentCount} appointment${appointmentCount === 1 ? "" : "s"} and ${invoiceItemCount} invoice line item${invoiceItemCount === 1 ? "" : "s"}. Mark it unavailable instead.`,
    };
  }

  await prisma.clinicService.delete({ where: { id: serviceId } });

  revalidatePath("/staff/clinic-services");
  return { success: true };
}

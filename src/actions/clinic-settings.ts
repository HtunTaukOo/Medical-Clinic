"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { CLINIC_SETTINGS_ID } from "@/lib/clinic-hours";

const settingsSchema = z
  .object({
    isOpen: z.enum(["open", "closed"]).transform((v) => v === "open"),
    openingTime: z.string().regex(/^\d{2}:\d{2}$/),
    closingTime: z.string().regex(/^\d{2}:\d{2}$/),
    staffTelegramChatId: z.string().optional(),
    phones: z.string().optional(),
    address: z.string().optional(),
  })
  .refine((data) => data.openingTime < data.closingTime, {
    message: "Opening time must be before closing time",
    path: ["closingTime"],
  });

export type ClinicSettingsFormState = { error?: string; success?: boolean };

export async function updateClinicSettings(
  _prevState: ClinicSettingsFormState,
  formData: FormData
): Promise<ClinicSettingsFormState> {
  await requireRole(["ADMIN"]);

  const parsed = settingsSchema.safeParse({
    isOpen: formData.get("isOpen"),
    openingTime: formData.get("openingTime"),
    closingTime: formData.get("closingTime"),
    staffTelegramChatId: formData.get("staffTelegramChatId") || undefined,
    phones: formData.get("phones") || undefined,
    address: formData.get("address") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { isOpen, openingTime, closingTime, staffTelegramChatId, address } = parsed.data;
  const phones = parsed.data.phones
    ? parsed.data.phones.split(",").map((p) => p.trim()).filter(Boolean)
    : [];

  await prisma.clinicSettings.upsert({
    where: { id: CLINIC_SETTINGS_ID },
    update: { isOpen, openingTime, closingTime, staffTelegramChatId, phones, address },
    create: {
      id: CLINIC_SETTINGS_ID,
      isOpen,
      openingTime,
      closingTime,
      staffTelegramChatId,
      phones,
      address,
    },
  });

  revalidatePath("/staff/settings");
  revalidatePath("/portal");
  revalidatePath("/portal/book");
  return { success: true };
}

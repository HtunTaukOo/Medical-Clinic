"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { CLINIC_SETTINGS_ID } from "@/lib/clinic-hours";

const profileSchema = z.object({
  name: z.string().min(1),
  email: z.union([z.email(), z.literal("")]).optional(),
  address: z.string().optional(),
  phones: z.array(z.string()).optional(),
});

export type ClinicSettingsFormState = { error?: string; success?: boolean };

export async function updateClinicProfile(
  _prevState: ClinicSettingsFormState,
  formData: FormData
): Promise<ClinicSettingsFormState> {
  await requireRole(["ADMIN"]);

  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email") || undefined,
    address: formData.get("address") || undefined,
    phones: formData.getAll("phones"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const phones = (parsed.data.phones ?? []).filter((p) => p.trim().length > 0);

  const logo = formData.get("logo");
  let logoData: Uint8Array<ArrayBuffer> | undefined;
  let logoType: string | undefined;
  if (logo instanceof File && logo.size > 0) {
    logoData = new Uint8Array(await logo.arrayBuffer()) as Uint8Array<ArrayBuffer>;
    logoType = logo.type;
  }

  await prisma.clinicSettings.upsert({
    where: { id: CLINIC_SETTINGS_ID },
    update: {
      name: parsed.data.name,
      email: parsed.data.email || null,
      address: parsed.data.address || null,
      phones,
      ...(logoData ? { logoData, logoType } : {}),
    },
    create: {
      id: CLINIC_SETTINGS_ID,
      name: parsed.data.name,
      email: parsed.data.email || null,
      address: parsed.data.address || null,
      phones,
      ...(logoData ? { logoData, logoType } : {}),
    },
  });

  revalidatePath("/staff/settings");
  revalidatePath("/portal");
  revalidatePath("/portal/book");
  revalidatePath("/portal/invoices");
  return { success: true };
}

const notificationsSchema = z.object({
  staffTelegramChatId: z.string().optional(),
});

export async function updateClinicNotifications(
  _prevState: ClinicSettingsFormState,
  formData: FormData
): Promise<ClinicSettingsFormState> {
  await requireRole(["ADMIN"]);

  const parsed = notificationsSchema.safeParse({
    staffTelegramChatId: formData.get("staffTelegramChatId") || undefined,
  });
  if (!parsed.success) {
    return { error: "Invalid input" };
  }

  await prisma.clinicSettings.upsert({
    where: { id: CLINIC_SETTINGS_ID },
    update: { staffTelegramChatId: parsed.data.staffTelegramChatId },
    create: { id: CLINIC_SETTINGS_ID, staffTelegramChatId: parsed.data.staffTelegramChatId },
  });

  revalidatePath("/staff/settings");
  return { success: true };
}

const dayHoursSchema = z.object({
  isOpen: z.enum(["on", "off"]).transform((v) => v === "on"),
  openTime: z.string().regex(/^\d{2}:\d{2}$/),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/),
});

const weeklyHoursSchema = z.object({
  days: z.array(dayHoursSchema).length(7),
});

export async function updateWeeklyHours(
  _prevState: ClinicSettingsFormState,
  formData: FormData
): Promise<ClinicSettingsFormState> {
  await requireRole(["ADMIN"]);

  const days = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
    isOpen: formData.get(`isOpen-${weekday}`) ? "on" : "off",
    openTime: formData.get(`openTime-${weekday}`),
    closeTime: formData.get(`closeTime-${weekday}`),
  }));

  const parsed = weeklyHoursSchema.safeParse({ days });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await prisma.$transaction(
    parsed.data.days.map((day, weekday) =>
      prisma.clinicWeeklyHours.upsert({
        where: { weekday },
        update: day,
        create: { weekday, ...day },
      })
    )
  );

  revalidatePath("/staff/settings");
  revalidatePath("/portal");
  revalidatePath("/portal/book");
  return { success: true };
}

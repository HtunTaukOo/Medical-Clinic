import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CLINIC_SETTINGS_ID } from "@/lib/clinic-hours";

// Public on purpose — this is the clinic's own branding, shown in the
// sidebar and on the (unauthenticated) login page, same as the static logo
// it replaces.
export async function GET() {
  const settings = await prisma.clinicSettings.findUnique({ where: { id: CLINIC_SETTINGS_ID } });
  if (!settings?.logoData) {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(settings.logoData, {
    headers: {
      "Content-Type": settings.logoType ?? "application/octet-stream",
      "Cache-Control": "public, max-age=60",
    },
  });
}

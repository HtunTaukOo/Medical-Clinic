import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CLINIC_SETTINGS_ID } from "@/lib/clinic-hours";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const settings = await prisma.clinicSettings.findUnique({ where: { id: CLINIC_SETTINGS_ID } });
  if (!settings?.logoData) {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(settings.logoData, {
    headers: {
      "Content-Type": settings.logoType ?? "application/octet-stream",
      "Cache-Control": "private, max-age=60",
    },
  });
}

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { STAFF_ROLES } from "@/lib/authz";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || !STAFF_ROLES.includes(session.user.role)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  const referral = await prisma.externalLabReferral.findUnique({ where: { id } });
  if (!referral || !referral.documentData) {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(referral.documentData, {
    headers: {
      "Content-Type": referral.documentType ?? "application/octet-stream",
      "Content-Disposition": `inline; filename="${referral.documentName ?? "document"}"`,
    },
  });
}

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { STAFF_ROLES } from "@/lib/authz";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  const record = await prisma.medicalRecord.findUnique({ where: { id } });
  if (!record || !record.fileData) {
    return new NextResponse("Not found", { status: 404 });
  }

  const role = session.user.role;
  const isStaff = STAFF_ROLES.includes(role);
  const isOwner = role === "PATIENT" && session.user.patientId === record.patientId;
  if (!isStaff && !isOwner) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  return new NextResponse(record.fileData, {
    headers: {
      "Content-Type": record.fileType ?? "application/octet-stream",
      "Content-Disposition": `inline; filename="${record.fileName ?? "document"}"`,
    },
  });
}

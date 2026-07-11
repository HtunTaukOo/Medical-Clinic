import type { Role } from "@prisma/client";
import { auth } from "@/auth";

export class UnauthorizedError extends Error {}

export const STAFF_ROLES: Role[] = [
  "ADMIN",
  "DOCTOR",
  "RECEPTIONIST",
  "PHARMACIST",
];

export async function requireSession() {
  const session = await auth();
  if (!session?.user) throw new UnauthorizedError("Not authenticated");
  return session;
}

export async function requireRole(roles: Role[]) {
  const session = await requireSession();
  if (!roles.includes(session.user.role)) {
    throw new UnauthorizedError("Forbidden");
  }
  return session;
}

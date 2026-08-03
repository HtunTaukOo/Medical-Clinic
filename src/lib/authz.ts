import type { Role } from "@prisma/client";
import { getLocale } from "next-intl/server";
import { auth } from "@/auth";
import { redirect } from "@/i18n/navigation";

export class UnauthorizedError extends Error {}

export const STAFF_ROLES: Role[] = [
  "ADMIN",
  "DOCTOR",
  "RECEPTIONIST",
  "PHARMACIST",
  "LAB_TECH",
];

export async function requireSession() {
  const session = await auth();
  if (!session?.user) throw new UnauthorizedError("Not authenticated");
  return session;
}

// For Server Actions (mutations): failing loudly is the right call, since a
// mismatched-role call here only happens via direct tampering (the UI never
// renders the triggering control for the wrong role) — not a normal user path.
export async function requireRole(roles: Role[]) {
  const session = await requireSession();
  if (!roles.includes(session.user.role)) {
    throw new UnauthorizedError("Forbidden");
  }
  return session;
}

// For page Server Components: an unhandled throw during render surfaces as a
// raw 500 error page (there's no error.tsx to catch it), which is a bad
// outcome for something as ordinary as a staff member hitting the wrong URL
// (bookmark, typo, stale link). Redirect them somewhere sane instead.
export async function requirePageRole(roles: Role[]) {
  const session = await requireSession();
  if (!roles.includes(session.user.role)) {
    const locale = await getLocale();
    redirect({ href: session.user.role === "PATIENT" ? "/portal" : "/staff", locale });
  }
  return session;
}

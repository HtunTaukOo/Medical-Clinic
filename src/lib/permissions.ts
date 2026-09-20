import { prisma } from "@/lib/prisma";

// Admin-editable overrides for what the STAFF role can do (Settings > Roles
// & Permissions). ADMIN always has full access and is never gated by this
// list; DOCTOR and PATIENT use entirely separate portals with their own
// pages, not a shared menu these keys could meaningfully restrict, so they
// stay fixed/reference-only in the UI.
//
// Manage Users and System Settings are deliberately NOT in this list even
// though they're shown in the reference table: both pages are full of
// ADMIN-only mutating forms (account creation with role selection, password
// resets, account deletion, specialty CRUD, this permission table itself)
// that aren't wired to accept a permitted STAFF caller. Granting page access
// alone would show a staff member fully interactive buttons that silently
// throw when clicked — worse than not offering them at all. Making those two
// real would mean rewiring each of those actions with its own escalation
// safeguards (e.g. a staff manager still can't grant ADMIN), which is a
// separate, larger piece of work.
export const STAFF_PERMISSION_KEYS = [
  "VIEW_APPOINTMENTS",
  "CREATE_APPOINTMENTS",
  "CONFIRM_RESCHEDULE_APPOINTMENTS",
  "CANCEL_APPOINTMENTS",
  "VIEW_PATIENTS",
  "EDIT_PATIENTS",
  "VIEW_BILLING",
  "MANAGE_BILLING",
  "VIEW_REPORTS",
] as const;

export type StaffPermissionKey = (typeof STAFF_PERMISSION_KEYS)[number];

export function isStaffPermissionKey(value: string): value is StaffPermissionKey {
  return (STAFF_PERMISSION_KEYS as readonly string[]).includes(value);
}

export const STAFF_PERMISSION_LABELS: Record<StaffPermissionKey, string> = {
  VIEW_APPOINTMENTS: "View Appointments",
  CREATE_APPOINTMENTS: "Create Appointments",
  CONFIRM_RESCHEDULE_APPOINTMENTS: "Confirm / Reschedule Appointments",
  CANCEL_APPOINTMENTS: "Cancel Appointments",
  VIEW_PATIENTS: "View Patients",
  EDIT_PATIENTS: "Edit Patients",
  VIEW_BILLING: "View Billing",
  MANAGE_BILLING: "Manage Billing",
  VIEW_REPORTS: "View Reports",
};

// Matches today's actual hardcoded behavior (View Reports was already an
// ADMIN-only page, everything else was open to any staff member), so
// seeding this table doesn't silently change anything until an admin
// actually edits a toggle.
export const STAFF_PERMISSION_DEFAULTS: Record<StaffPermissionKey, boolean> = {
  VIEW_APPOINTMENTS: true,
  CREATE_APPOINTMENTS: true,
  CONFIRM_RESCHEDULE_APPOINTMENTS: true,
  CANCEL_APPOINTMENTS: true,
  VIEW_PATIENTS: true,
  EDIT_PATIENTS: true,
  VIEW_BILLING: true,
  MANAGE_BILLING: true,
  VIEW_REPORTS: false,
};

// Seeds any missing keys with their default, then returns all of them
// ordered to match STAFF_PERMISSION_KEYS, so the Settings UI always sees a
// complete set even before an admin has touched anything.
export async function getStaffPermissions() {
  const existing = await prisma.staffPermission.findMany();
  const existingByKey = new Map(existing.map((p) => [p.key, p]));
  const missing = STAFF_PERMISSION_KEYS.filter((key) => !existingByKey.has(key));
  if (missing.length > 0) {
    await prisma.staffPermission.createMany({
      data: missing.map((key) => ({ key, enabled: STAFF_PERMISSION_DEFAULTS[key] })),
      skipDuplicates: true,
    });
    const refreshed = await prisma.staffPermission.findMany();
    const refreshedByKey = new Map(refreshed.map((p) => [p.key, p]));
    return STAFF_PERMISSION_KEYS.map((key) => refreshedByKey.get(key)!);
  }
  return STAFF_PERMISSION_KEYS.map((key) => existingByKey.get(key)!);
}

// Cheap enough to call per-request — this table only ever has a handful of
// tiny rows.
export async function isStaffPermissionEnabled(key: StaffPermissionKey): Promise<boolean> {
  const row = await prisma.staffPermission.findUnique({ where: { key } });
  if (row) return row.enabled;
  // Not seeded yet (first call anywhere before the Settings page has ever
  // been loaded) — fall back to today's real, pre-existing behavior.
  return STAFF_PERMISSION_DEFAULTS[key];
}

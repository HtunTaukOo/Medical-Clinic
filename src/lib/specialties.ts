import {
  Stethoscope,
  HeartPulse,
  Baby,
  Sparkles,
  Bone,
  Ear,
  Venus,
  Eye,
  Brain,
  Pill,
  Syringe,
  Microscope,
  Activity,
  Thermometer,
  TestTube,
  Bandage,
  ShieldPlus,
  Droplet,
  type LucideIcon,
} from "lucide-react";

// The fixed set of icons an admin can assign to a specialty — icons are React
// components, so unlike name/description they can't come from the database
// itself; this is the closed palette to pick from instead.
export const SPECIALTY_ICONS = {
  Stethoscope,
  HeartPulse,
  Baby,
  Sparkles,
  Bone,
  Ear,
  Venus,
  Eye,
  Brain,
  Pill,
  Syringe,
  Microscope,
  Activity,
  Thermometer,
  TestTube,
  Bandage,
  ShieldPlus,
  Droplet,
} satisfies Record<string, LucideIcon>;

export type SpecialtyIconName = keyof typeof SPECIALTY_ICONS;
export const SPECIALTY_ICON_NAMES = Object.keys(SPECIALTY_ICONS) as SpecialtyIconName[];

export function getSpecialtyIcon(icon: string | null | undefined): LucideIcon {
  if (icon && icon in SPECIALTY_ICONS) return SPECIALTY_ICONS[icon as SpecialtyIconName];
  return Stethoscope;
}

// Matches a doctor's or service's free-text specialty field to one of the
// clinic's configured specialty names (case-insensitive), so real data lines
// up with the booking wizard's specialty grid regardless of exact casing.
export function matchSpecialty(
  specialty: string | null | undefined,
  specialtyNames: readonly string[]
): string | null {
  if (!specialty) return null;
  const trimmed = specialty.trim().toLowerCase();
  return specialtyNames.find((name) => name.toLowerCase() === trimmed) ?? null;
}

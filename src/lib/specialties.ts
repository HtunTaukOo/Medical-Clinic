import { Stethoscope, HeartPulse, Baby, Sparkles, Bone, Ear, Venus, Eye } from "lucide-react";

export const SPECIALTY_TAXONOMY = [
  {
    name: "General Medicine",
    icon: Stethoscope,
    description: "Check-ups, fever, cough, general health",
  },
  {
    name: "Cardiology",
    icon: HeartPulse,
    description: "Heart health, blood pressure, chest pain",
  },
  { name: "Pediatrics", icon: Baby, description: "Children's health, vaccinations, growth" },
  {
    name: "Dermatology",
    icon: Sparkles,
    description: "Skin, hair, nail conditions & cosmetic",
  },
  { name: "Orthopedics", icon: Bone, description: "Joints, bones, muscles, sports injuries" },
  { name: "ENT", icon: Ear, description: "Ear, nose, throat, sinuses & voice" },
  { name: "Obs & Gynecology", icon: Venus, description: "Maternal health, women's wellness" },
  { name: "Ophthalmology", icon: Eye, description: "Vision, eye disease, glasses & surgery" },
] as const;

export type SpecialtyName = (typeof SPECIALTY_TAXONOMY)[number]["name"];

// Matches a doctor's free-text specialty field to one of the fixed taxonomy
// entries above (case-insensitive), so real doctor data lines up with the
// booking wizard's specialty grid regardless of exact casing.
export function matchSpecialty(specialty: string | null | undefined): SpecialtyName | null {
  if (!specialty) return null;
  const trimmed = specialty.trim().toLowerCase();
  const match = SPECIALTY_TAXONOMY.find((s) => s.name.toLowerCase() === trimmed);
  return match?.name ?? null;
}

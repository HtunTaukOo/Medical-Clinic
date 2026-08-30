export const SPECIALTY_TAXONOMY = [
  { name: "General Medicine", emoji: "🩺", description: "Check-ups, fever, cough, general health" },
  { name: "Cardiology", emoji: "❤️", description: "Heart health, blood pressure, chest pain" },
  { name: "Pediatrics", emoji: "👶", description: "Children's health, vaccinations, growth" },
  { name: "Dermatology", emoji: "🌿", description: "Skin, hair, nail conditions & cosmetic" },
  { name: "Orthopedics", emoji: "🦴", description: "Joints, bones, muscles, sports injuries" },
  { name: "ENT", emoji: "👂", description: "Ear, nose, throat, sinuses & voice" },
  { name: "Obs & Gynecology", emoji: "👩‍⚕️", description: "Maternal health, women's wellness" },
  { name: "Ophthalmology", emoji: "👁️", description: "Vision, eye disease, glasses & surgery" },
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

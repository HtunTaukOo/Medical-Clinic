export function getDisplayFirstName(fullName: string) {
  const parts = fullName.split(" ").filter(Boolean);
  if (parts.length > 1 && /\.$/.test(parts[0])) {
    return `${parts[0]} ${parts[1]}`;
  }
  return parts[0] ?? "";
}

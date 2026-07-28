export function getDisplayFirstName(fullName: string) {
  const parts = fullName.split(" ").filter(Boolean);
  if (parts.length > 1 && /\.$/.test(parts[0])) {
    return `${parts[0]} ${parts[1]}`;
  }
  return parts[0] ?? "";
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

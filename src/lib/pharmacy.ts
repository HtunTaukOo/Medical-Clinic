export function rxCode(id: string, createdAt: Date) {
  return `RX-${createdAt.getFullYear()}-${id.slice(-4).toUpperCase()}`;
}

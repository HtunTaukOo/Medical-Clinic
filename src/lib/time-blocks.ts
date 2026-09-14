// Fixed daily booking blocks for BLOCK_CAPACITY specialties. Pure constants —
// no `prisma` import — so this is safely importable from client components
// (the booking wizard, block picker, etc.) without pulling server-only code
// into the browser bundle.

export type TimeBlockId = "block1" | "block2" | "block3" | "block4" | "block5";

export type TimeBlockDef = {
  id: TimeBlockId;
  startTime: string; // "HH:mm", clinic-local
  endTime: string; // "HH:mm", clinic-local
};

export const TIME_BLOCKS: readonly TimeBlockDef[] = [
  { id: "block1", startTime: "08:00", endTime: "10:00" },
  { id: "block2", startTime: "10:00", endTime: "12:00" },
  { id: "block3", startTime: "13:00", endTime: "15:00" },
  { id: "block4", startTime: "15:00", endTime: "17:00" },
  { id: "block5", startTime: "17:00", endTime: "20:00" },
];

function toMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function getTimeBlockById(id: string): TimeBlockDef | undefined {
  return TIME_BLOCKS.find((b) => b.id === id);
}

export function formatTimeLabel(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  return `${hour12}:${String(minutes).padStart(2, "0")} ${period}`;
}

export function formatBlockLabel(block: TimeBlockDef): string {
  return `${formatTimeLabel(block.startTime)} – ${formatTimeLabel(block.endTime)}`;
}

export function blockDurationMinutes(block: TimeBlockDef): number {
  return toMinutes(block.endTime) - toMinutes(block.startTime);
}

// The block whose [startTime, endTime) window contains this minute-of-day, if any.
export function blockContainingMinuteOfDay(minutesOfDay: number): TimeBlockDef | null {
  return (
    TIME_BLOCKS.find(
      (b) => minutesOfDay >= toMinutes(b.startTime) && minutesOfDay < toMinutes(b.endTime)
    ) ?? null
  );
}

// Fallback for walk-ins outside all block hours (e.g. before 8am) — clamps to
// whichever block is closest in time, so staff can still register the visit.
export function nearestBlock(minutesOfDay: number): TimeBlockDef {
  const contained = blockContainingMinuteOfDay(minutesOfDay);
  if (contained) return contained;

  return TIME_BLOCKS.reduce((closest, block) => {
    const distance = Math.min(
      Math.abs(minutesOfDay - toMinutes(block.startTime)),
      Math.abs(minutesOfDay - toMinutes(block.endTime))
    );
    const closestDistance = Math.min(
      Math.abs(minutesOfDay - toMinutes(closest.startTime)),
      Math.abs(minutesOfDay - toMinutes(closest.endTime))
    );
    return distance < closestDistance ? block : closest;
  }, TIME_BLOCKS[0]);
}

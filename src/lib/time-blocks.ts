// Booking blocks for BLOCK_CAPACITY/SERVICE_CAPACITY specialties, generated
// from the clinic's actual per-weekday hours (see getBlocksForDate in
// booking-slots.ts) rather than a fixed global list — different weekdays
// (e.g. a shorter Saturday) naturally get fewer/shorter blocks. Pure
// constants and functions only — no `prisma` import — so this stays safely
// importable from client components (the booking wizard, block picker,
// etc.) without pulling server-only code into the browser bundle. Because
// block definitions now depend on which day they're for, a block id alone
// no longer resolves to a definition — callers need that day's generated
// list (from getBlocksForDate) to look one up.

export type TimeBlockDef = {
  id: string;
  startTime: string; // "HH:mm", clinic-local
  endTime: string; // "HH:mm", clinic-local
};

export const STANDARD_BLOCK_MINUTES = 120;

function toMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function toTimeString(minutes: number) {
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

// Divides one day's open-to-close window into consecutive 2-hour blocks. A
// remainder shorter than 2 hours (e.g. clinic opens/closes on the half-block)
// still becomes its own trailing block, just shorter — see blockCapacity for
// how its capacity is scaled down to match, rather than being dropped.
export function generateTimeBlocks(openTime: string, closeTime: string): TimeBlockDef[] {
  const open = toMinutes(openTime);
  const close = toMinutes(closeTime);
  const blocks: TimeBlockDef[] = [];
  let cursor = open;
  let index = 1;
  while (cursor < close) {
    const end = Math.min(cursor + STANDARD_BLOCK_MINUTES, close);
    blocks.push({ id: `block${index}`, startTime: toTimeString(cursor), endTime: toTimeString(end) });
    cursor = end;
    index++;
  }
  return blocks;
}

export function blockDurationMinutes(block: TimeBlockDef): number {
  return toMinutes(block.endTime) - toMinutes(block.startTime);
}

// A block shorter than the standard 2 hours (the trailing block on a day
// whose hours don't divide evenly) gets proportionally less capacity instead
// of the specialty's full capacityPerSlot — e.g. a 1-hour remainder on a
// capacityPerSlot=10 specialty becomes 5, matching a full block's per-hour
// rate rather than either the full or zero capacity.
export function blockCapacity(block: TimeBlockDef, capacityPerSlot: number): number {
  const ratio = blockDurationMinutes(block) / STANDARD_BLOCK_MINUTES;
  return Math.max(1, Math.round(capacityPerSlot * ratio));
}

export function formatTimeLabel(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  return `${hour12}:${String(minutes).padStart(2, "0")} ${period}`;
}

export function formatBlockLabel(block: { startTime: string; endTime: string }): string {
  return `${formatTimeLabel(block.startTime)} – ${formatTimeLabel(block.endTime)}`;
}

// The block (from this day's own generated list) whose [startTime, endTime)
// window contains this minute-of-day, if any.
export function blockContainingMinuteOfDay(
  blocks: readonly TimeBlockDef[],
  minutesOfDay: number
): TimeBlockDef | null {
  return (
    blocks.find((b) => minutesOfDay >= toMinutes(b.startTime) && minutesOfDay < toMinutes(b.endTime)) ??
    null
  );
}

// Fallback for walk-ins outside all block hours (e.g. before opening) —
// clamps to whichever of this day's blocks is closest in time. Null only
// when the day has no blocks at all (clinic closed that day).
export function nearestBlock(
  blocks: readonly TimeBlockDef[],
  minutesOfDay: number
): TimeBlockDef | null {
  const contained = blockContainingMinuteOfDay(blocks, minutesOfDay);
  if (contained) return contained;
  if (blocks.length === 0) return null;

  return blocks.reduce((closest, block) => {
    const distance = Math.min(
      Math.abs(minutesOfDay - toMinutes(block.startTime)),
      Math.abs(minutesOfDay - toMinutes(block.endTime))
    );
    const closestDistance = Math.min(
      Math.abs(minutesOfDay - toMinutes(closest.startTime)),
      Math.abs(minutesOfDay - toMinutes(closest.endTime))
    );
    return distance < closestDistance ? block : closest;
  }, blocks[0]);
}

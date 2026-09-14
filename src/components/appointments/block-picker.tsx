"use client";

import { useEffect, useState, useTransition } from "react";
import { fetchBlockAvailability } from "@/actions/booking";
import type { BlockAvailability } from "@/lib/booking-slots";
import { formatTimeLabel } from "@/lib/time-blocks";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Shared date + fixed-block picker for BLOCK_CAPACITY specialties, used by
// staff/doctor manual appointment creation and rescheduling — a simpler,
// native-date-input variant of the patient booking wizard's calendar step,
// since staff already know roughly when they want to book.
export function BlockPicker({
  specialtyName,
  capacityPerSlot,
  dateInputName = "blockDate",
  blockInputName = "blockId",
  defaultDate,
  defaultBlockId,
}: {
  specialtyName: string;
  capacityPerSlot: number;
  dateInputName?: string;
  blockInputName?: string;
  defaultDate?: string;
  defaultBlockId?: string;
}) {
  const [date, setDate] = useState(defaultDate ?? "");
  const [blockId, setBlockId] = useState<string | null>(defaultBlockId ?? null);
  const [blocks, setBlocks] = useState<BlockAvailability[]>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!date) return;
    const [year, month, day] = date.split("-").map(Number);
    if (!year || !month || !day) return;
    startTransition(async () => {
      const result = await fetchBlockAvailability(specialtyName, capacityPerSlot, year, month, day);
      setBlocks(result);
    });
  }, [date, specialtyName, capacityPerSlot]);

  const visibleBlocks = date ? blocks : [];

  return (
    <div className="grid gap-2">
      <Label htmlFor="block-picker-date">Date</Label>
      <Input
        id="block-picker-date"
        type="date"
        required
        value={date}
        onChange={(e) => {
          setDate(e.target.value);
          setBlockId(null);
        }}
      />
      <input type="hidden" name={dateInputName} value={date} />
      <input type="hidden" name={blockInputName} value={blockId ?? ""} />

      {date && (
        <div className="grid gap-2">
          <Label>Time Block</Label>
          {pending ? (
            <p className="text-sm text-muted-foreground">Loading blocks…</p>
          ) : visibleBlocks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No blocks available this day.</p>
          ) : (
            <div className="grid gap-2">
              {visibleBlocks.map((b) => {
                const selected = blockId === b.blockId;
                return (
                  <button
                    key={b.blockId}
                    type="button"
                    disabled={!b.available}
                    onClick={() => setBlockId(b.blockId)}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : b.available
                          ? "hover:bg-muted/50"
                          : "text-muted-foreground/40 line-through"
                    }`}
                  >
                    <span>
                      {formatTimeLabel(b.startTime)} – {formatTimeLabel(b.endTime)}
                    </span>
                    <span className={selected ? "" : "text-muted-foreground"}>
                      {b.available ? `${b.occupied}/${b.capacity} booked` : "Full"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

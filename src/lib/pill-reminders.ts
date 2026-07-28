const PRESET_SLOTS: Record<number, number[]> = {
  1: [9],
  2: [9, 21],
  3: [8, 14, 20],
  4: [8, 12, 16, 20],
};

export function getReminderHours(timesPerDay: number): number[] {
  if (PRESET_SLOTS[timesPerDay]) return PRESET_SLOTS[timesPerDay];

  const start = 8;
  const end = 22;
  if (timesPerDay <= 1) return [start];
  const step = (end - start) / (timesPerDay - 1);
  return Array.from({ length: timesPerDay }, (_, i) => Math.round(start + step * i));
}

export function generateReminderSchedule(
  startDate: Date,
  timesPerDay: number,
  durationDays: number,
  now: Date = new Date()
): Date[] {
  const hours = getReminderHours(timesPerDay);
  const schedule: Date[] = [];

  for (let day = 0; day < durationDays; day++) {
    for (const hour of hours) {
      const slot = new Date(startDate);
      slot.setDate(slot.getDate() + day);
      slot.setHours(hour, 0, 0, 0);
      if (slot > now) {
        schedule.push(slot);
      }
    }
  }

  return schedule;
}

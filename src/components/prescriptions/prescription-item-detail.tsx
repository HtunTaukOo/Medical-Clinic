// Shared "how to take this medicine" detail line for any view that lists
// PrescriptionItems outside the patient portal (which has its own richer,
// translated PrescriptionHistoryList) — doctor/staff appointment and
// patient-chart views previously only showed the medicine name and dosage,
// dropping the frequency/duration/refills/instructions the doctor actually
// wrote, even though that data was already being fetched.
type Item = {
  quantity?: number | null;
  frequency?: string | null;
  timesPerDay?: number | null;
  durationDays?: number | null;
  instructions?: string | null;
  refillsLeft?: number | null;
};

export function PrescriptionItemDetail({ item }: { item: Item }) {
  const frequency = item.frequency ?? (item.timesPerDay ? `${item.timesPerDay}x daily` : null);
  const details = [
    item.quantity != null ? `Qty ${item.quantity}` : null,
    frequency,
    item.durationDays != null ? `${item.durationDays} day${item.durationDays === 1 ? "" : "s"}` : null,
    item.refillsLeft != null
      ? `${item.refillsLeft} refill${item.refillsLeft === 1 ? "" : "s"} left`
      : null,
  ].filter((v): v is string => v != null);

  if (details.length === 0 && !item.instructions) return null;

  return (
    <>
      {details.length > 0 && (
        <p className="text-xs text-muted-foreground">{details.join(" · ")}</p>
      )}
      {item.instructions && (
        <p className="text-xs text-muted-foreground italic">{item.instructions}</p>
      )}
    </>
  );
}

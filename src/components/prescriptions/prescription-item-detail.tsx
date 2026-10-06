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
  const t = useTranslations("clinical");
  const frequency = item.frequency ?? (item.timesPerDay ? t("timesDaily", { count: item.timesPerDay }) : null);
  const details = [
    item.quantity != null ? t("quantityDetail", { count: item.quantity }) : null,
    frequency,
    item.durationDays != null ? t("durationDays", { count: item.durationDays }) : null,
    item.refillsLeft != null ? t("refillsLeft", { count: item.refillsLeft }) : null,
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
import { useTranslations } from "next-intl";

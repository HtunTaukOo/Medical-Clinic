import { ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

export const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-purple-100 text-purple-700",
  "bg-orange-100 text-orange-700",
  "bg-rose-100 text-rose-700",
  "bg-indigo-100 text-indigo-700",
  "bg-cyan-100 text-cyan-700",
];

export const GENDER_LETTER: Record<string, string> = {
  MALE: "M",
  FEMALE: "F",
  OTHER: "O",
};

export function AppointmentRow({
  href,
  time,
  dateLabel,
  avatarIndex,
  patientName,
  age,
  genderLetter,
  reason,
  isUrgent = false,
  statusLabel,
  statusClassName,
}: {
  href: string;
  time: string;
  dateLabel?: string;
  avatarIndex: number;
  patientName: string;
  age: number | null;
  genderLetter: string | null;
  reason: string;
  isUrgent?: boolean;
  statusLabel: string;
  statusClassName: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-lg border-l-4 border p-3 hover:bg-muted/50",
        isUrgent
          ? "border-l-red-500 border-red-200 bg-red-50 dark:bg-red-950/20"
          : "border-l-transparent"
      )}
    >
      <div className="flex items-center gap-3">
        <div className="w-14 shrink-0 text-sm text-muted-foreground">
          <p>{time}</p>
          {dateLabel && <p className="text-xs">{dateLabel}</p>}
        </div>
        <Avatar className="size-9">
          <AvatarFallback className={AVATAR_COLORS[avatarIndex % AVATAR_COLORS.length]}>
            {initials(patientName)}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="font-medium">
            {patientName}
            {(age != null || genderLetter) && (
              <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                · {age != null ? age : ""}
                {genderLetter ?? ""}
              </span>
            )}
            {isUrgent && (
              <Badge variant="destructive" className="ml-2 align-middle">
                URGENT
              </Badge>
            )}
          </p>
          <p className="text-sm text-muted-foreground">{reason || "No reason given"}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline" className={statusClassName}>
          {statusLabel}
        </Badge>
        <ChevronRight className="size-4 text-muted-foreground" />
      </div>
    </Link>
  );
}

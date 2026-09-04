import { ChevronDown } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { initials } from "@/lib/format";
import { AVATAR_COLORS } from "@/components/appointments/appointment-row";
import { cn } from "@/lib/utils";

export function PatientAppointmentCard({
  href,
  avatarIndex,
  doctorName,
  specialty,
  reason,
  dateLabel,
  timeLabel,
  statusLabel,
  statusClassName,
}: {
  href: string;
  avatarIndex: number;
  doctorName: string;
  specialty: string;
  reason: string | null;
  dateLabel: string;
  timeLabel: string;
  statusLabel: string;
  statusClassName: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 rounded-xl border bg-white p-4 transition-colors hover:bg-muted/50"
    >
      <Avatar className="size-11 shrink-0">
        <AvatarFallback className={AVATAR_COLORS[avatarIndex % AVATAR_COLORS.length]}>
          {initials(doctorName)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold">{doctorName}</p>
          <Badge variant="outline" className={cn("border-transparent", statusClassName)}>
            {statusLabel}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{specialty}</p>
        {reason && <p className="truncate text-sm text-muted-foreground">{reason}</p>}
      </div>
      <div className="shrink-0 text-right">
        <p className="font-semibold text-primary">{dateLabel}</p>
        <p className="text-sm text-muted-foreground">{timeLabel}</p>
        <ChevronDown className="mt-1 ml-auto size-4 text-muted-foreground" />
      </div>
    </Link>
  );
}

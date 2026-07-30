import { notFound } from "next/navigation";
import { Stethoscope, Wallet, Clock } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { WEEKDAY_LABELS } from "@/lib/doctor-availability";
import { formatTime } from "@/lib/clinic-hours";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { initials } from "@/lib/format";

export default async function DoctorProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getTranslations("appointments");
  const { id } = await params;

  const doctor = await prisma.doctorProfile.findUnique({
    where: { id },
    include: { user: true },
  });
  if (!doctor) notFound();

  const workingDaysLabel = doctor.workingDays.length
    ? [...doctor.workingDays].sort((a, b) => a - b).map((d) => WEEKDAY_LABELS[d]).join(", ")
    : "Not set";
  const hoursLabel =
    doctor.workStartTime && doctor.workEndTime
      ? `${formatTime(doctor.workStartTime)} – ${formatTime(doctor.workEndTime)}`
      : "Clinic default hours";

  return (
    <div className="grid gap-6">
      <div className="flex items-center gap-4">
        <Avatar className="size-16">
          <AvatarFallback className="bg-secondary text-secondary-foreground text-lg">
            {initials(doctor.user.name)}
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl font-semibold">{doctor.user.name}</h1>
          <p className="text-muted-foreground">{doctor.specialty ?? "General Practice"}</p>
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-4">
          <div className="flex items-center gap-3">
            <Stethoscope className="size-4 text-muted-foreground" />
            <span>{doctor.specialty ?? "General Practice"}</span>
          </div>
          <div className="flex items-center gap-3">
            <Wallet className="size-4 text-muted-foreground" />
            <span>Consultation fee: {Number(doctor.consultationFee).toFixed(2)}</span>
          </div>
          <div className="flex items-center gap-3">
            <Clock className="size-4 text-muted-foreground" />
            <span>
              {workingDaysLabel} · {hoursLabel}
            </span>
          </div>
        </CardContent>
      </Card>

      <Button asChild className="w-fit">
        <Link href={`/portal/appointments/new?doctorId=${doctor.id}`}>{t("requestNew")}</Link>
      </Button>
    </div>
  );
}

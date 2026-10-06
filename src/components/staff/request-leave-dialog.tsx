"use client";

import { CalendarPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DoctorLeaveForm } from "@/components/staff/doctor-leave-form";

export function RequestLeaveDialog({ doctorId }: { doctorId: string }) {
  const t = useTranslations("doctorSchedule");
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <CalendarPlus className="size-4" />
          {t("requestLeave")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("requestLeave")}</DialogTitle>
          <DialogDescription>
            {t("requestLeaveDescription")}
          </DialogDescription>
        </DialogHeader>
        <DoctorLeaveForm doctorId={doctorId} />
      </DialogContent>
    </Dialog>
  );
}

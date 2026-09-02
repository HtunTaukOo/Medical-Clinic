"use client";

import { CalendarPlus } from "lucide-react";
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
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <CalendarPlus className="size-4" />
          Request Leave
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request Leave</DialogTitle>
          <DialogDescription>
            Block a day on your schedule so patients can&apos;t book appointments then.
          </DialogDescription>
        </DialogHeader>
        <DoctorLeaveForm doctorId={doctorId} />
      </DialogContent>
    </Dialog>
  );
}

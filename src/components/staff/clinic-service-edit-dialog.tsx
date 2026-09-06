"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ClinicServiceForm } from "@/components/staff/clinic-service-form";

export function ClinicServiceEditDialog({
  service,
}: {
  service: {
    id: string;
    name: string;
    specialty: string | null;
    durationMinutes: number;
    price: number;
    room: string | null;
    active: boolean;
  };
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className="font-medium text-primary underline underline-offset-2">
          Edit
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {service.name}</DialogTitle>
        </DialogHeader>
        <ClinicServiceForm service={service} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SpecialtyForm } from "@/components/staff/specialty-form";

export function SpecialtyDialog({
  specialty,
  trigger,
}: {
  specialty?: {
    id: string;
    name: string;
    icon: string;
    description: string | null;
    bookByService: boolean;
    capacityPerSlot: number;
  };
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{specialty ? `Edit ${specialty.name}` : "Add Specialty"}</DialogTitle>
        </DialogHeader>
        <SpecialtyForm specialty={specialty} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

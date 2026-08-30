"use client";

import { useState, type ReactNode } from "react";
import { Pill, FlaskConical, CalendarPlus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

export function ConsultationQuickActions({
  prescribeSlot,
  labSlot,
  followUpHref,
}: {
  prescribeSlot: ReactNode;
  labSlot: ReactNode;
  followUpHref: string;
}) {
  const [open, setOpen] = useState<"prescribe" | "lab" | null>(null);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => setOpen(open === "prescribe" ? null : "prescribe")}
          className="bg-emerald-600 text-white hover:bg-emerald-700"
        >
          <Pill className="size-4" />
          Prescribe
        </Button>
        <Button
          type="button"
          onClick={() => setOpen(open === "lab" ? null : "lab")}
          className="bg-purple-600 text-white hover:bg-purple-700"
        >
          <FlaskConical className="size-4" />
          Request Lab
        </Button>
        <Button asChild className="bg-orange-500 text-white hover:bg-orange-600">
          <Link href={followUpHref}>
            <CalendarPlus className="size-4" />
            Follow-up
          </Link>
        </Button>
      </div>
      {open === "prescribe" && <div className="rounded-xl border p-4">{prescribeSlot}</div>}
      {open === "lab" && <div className="rounded-xl border p-4">{labSlot}</div>}
    </div>
  );
}

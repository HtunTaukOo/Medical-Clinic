"use client";

import { useState } from "react";
import { Megaphone } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { AnnouncementForm } from "@/components/staff/announcement-form";

export function NewAnnouncementDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Megaphone className="size-4" />
          New Announcement
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Announcement</DialogTitle>
          <DialogDescription>
            Post a message that every staff member will see.
          </DialogDescription>
        </DialogHeader>
        <AnnouncementForm onPosted={() => setOpen(false)} />
        <Link
          href="/staff/announcements"
          className="text-sm text-muted-foreground underline underline-offset-2"
        >
          View all announcements
        </Link>
      </DialogContent>
    </Dialog>
  );
}

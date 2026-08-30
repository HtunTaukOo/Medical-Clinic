"use client";

import { useActionState } from "react";
import {
  createAnnouncement,
  type AnnouncementFormState,
} from "@/actions/announcements";
import { ANNOUNCEMENT_CATEGORIES } from "@/lib/announcements";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function AnnouncementForm() {
  const [state, formAction, pending] = useActionState<
    AnnouncementFormState,
    FormData
  >(createAnnouncement, {});

  return (
    <form
      action={formAction}
      key={state.success ? "reset" : "form"}
      className="grid max-w-md gap-4"
    >
      <div className="grid gap-2">
        <Label htmlFor="announcement-title">Title</Label>
        <Input id="announcement-title" name="title" required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="announcement-category">Category</Label>
        <Select name="category" defaultValue="General">
          <SelectTrigger id="announcement-category" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ANNOUNCEMENT_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="announcement-body">Message</Label>
        <Textarea id="announcement-body" name="body" rows={3} required />
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending} className="w-fit">
        Post announcement
      </Button>
    </form>
  );
}

"use client";

import { useActionState, useEffect, useState } from "react";
import {
  createClinicService,
  updateClinicService,
  type ClinicServiceFormState,
} from "@/actions/clinic-services";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NO_SPECIALTY = "__none__";

export function ClinicServiceForm({
  service,
  specialties,
  onSaved,
}: {
  service?: {
    id: string;
    name: string;
    specialty: string | null;
    durationMinutes: number;
    price: number;
    room: string | null;
    active: boolean;
  };
  specialties: { name: string }[];
  onSaved?: () => void;
}) {
  const router = useRouter();
  const action = service ? updateClinicService.bind(null, service.id) : createClinicService;
  const [state, formAction, pending] = useActionState<ClinicServiceFormState, FormData>(
    action,
    {}
  );
  const [specialty, setSpecialty] = useState(service?.specialty ?? NO_SPECIALTY);

  useEffect(() => {
    if (state.success) {
      if (onSaved) onSaved();
      else router.push("/staff/clinic-services");
    }
  }, [state.success, onSaved, router]);

  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="name">Service Name</Label>
        <Input id="name" name="name" defaultValue={service?.name} required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="specialty">Specialty</Label>
          <Select value={specialty} onValueChange={setSpecialty}>
            <SelectTrigger id="specialty" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_SPECIALTY}>No specialty</SelectItem>
              {specialties.map((s) => (
                <SelectItem key={s.name} value={s.name}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input type="hidden" name="specialty" value={specialty === NO_SPECIALTY ? "" : specialty} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="room">Room</Label>
          <Input id="room" name="room" defaultValue={service?.room ?? ""} placeholder="e.g. Room 204" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="durationMinutes">Duration (minutes)</Label>
          <Input
            id="durationMinutes"
            name="durationMinutes"
            type="number"
            min={5}
            step={5}
            defaultValue={service?.durationMinutes ?? 15}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="price">Price (K)</Label>
          <Input
            id="price"
            name="price"
            type="number"
            min={0}
            step="0.01"
            defaultValue={service?.price ?? 0}
            required
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="active"
          defaultChecked={service?.active ?? true}
          className="size-4"
        />
        Available
      </label>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending} className="w-fit">
        {service ? "Save Changes" : "Add Service"}
      </Button>
    </form>
  );
}

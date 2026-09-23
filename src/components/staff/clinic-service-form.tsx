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
const NO_LAB_TEST = "__none__";

export function ClinicServiceForm({
  service,
  specialties,
  labTests,
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
    labTestId?: string | null;
  };
  specialties: { name: string; bookByService: boolean }[];
  labTests: { id: string; name: string; price: number }[];
  onSaved?: () => void;
}) {
  const router = useRouter();
  const action = service ? updateClinicService.bind(null, service.id) : createClinicService;
  const [state, formAction, pending] = useActionState<ClinicServiceFormState, FormData>(
    action,
    {}
  );
  const [specialty, setSpecialty] = useState(service?.specialty ?? NO_SPECIALTY);
  const [labTestId, setLabTestId] = useState(service?.labTestId ?? NO_LAB_TEST);
  const showLabTestPicker = specialties.some((s) => s.name === specialty && s.bookByService);
  const linkedLabTest = labTests.find((t) => t.id === labTestId);

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
      {showLabTestPicker && (
        <div className="grid gap-2">
          <Label htmlFor="labTestId">Linked Lab Test</Label>
          <Select value={labTestId} onValueChange={setLabTestId}>
            <SelectTrigger id="labTestId" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_LAB_TEST}>Not linked to a lab test</SelectItem>
              {labTests.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input type="hidden" name="labTestId" value={labTestId === NO_LAB_TEST ? "" : labTestId} />
          <p className="text-xs text-muted-foreground">
            When linked, booking this service will automatically create a lab order for this test, and its price
            stays synced with the lab test catalog.
          </p>
        </div>
      )}
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
          <Label htmlFor="price">Price (MMK)</Label>
          <Input
            key={labTestId}
            id="price"
            name="price"
            type="number"
            min={0}
            step="0.01"
            defaultValue={linkedLabTest ? linkedLabTest.price : (service?.price ?? 0)}
            readOnly={!!linkedLabTest}
            className={linkedLabTest ? "bg-muted" : undefined}
            required
          />
          {linkedLabTest && (
            <p className="text-xs text-muted-foreground">Synced with the linked lab test&apos;s price.</p>
          )}
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

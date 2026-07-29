import { CalendarOff } from "lucide-react";
import { removeDoctorLeave } from "@/actions/staff";
import { DoctorLeaveForm } from "@/components/staff/doctor-leave-form";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";

export function DoctorLeaveManager({
  doctorId,
  leaveDays,
}: {
  doctorId: string;
  leaveDays: { id: string; date: Date; reason: string | null }[];
}) {
  return (
    <div className="grid gap-4">
      <DoctorLeaveForm doctorId={doctorId} />
      {leaveDays.length === 0 ? (
        <EmptyState icon={CalendarOff} message="No upcoming leave days scheduled." />
      ) : (
        <div className="grid gap-2">
          {leaveDays.map((leave) => (
            <div key={leave.id} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium">
                  {leave.date.toLocaleDateString(undefined, {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
                {leave.reason && <p className="text-sm text-muted-foreground">{leave.reason}</p>}
              </div>
              <form action={removeDoctorLeave.bind(null, leave.id)}>
                <Button size="sm" variant="destructive" type="submit">
                  Remove
                </Button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

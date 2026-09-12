import { CalendarOff } from "lucide-react";
import type { DoctorLeaveStatus } from "@prisma/client";
import { approveDoctorLeave, rejectDoctorLeave, removeDoctorLeave } from "@/actions/staff";
import { DoctorLeaveForm } from "@/components/staff/doctor-leave-form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/empty-state";

export function DoctorLeaveManager({
  doctorId,
  leaveDays,
  showForm = true,
  canDecide = false,
}: {
  doctorId: string;
  leaveDays: { id: string; date: Date; reason: string | null; status: DoctorLeaveStatus }[];
  showForm?: boolean;
  canDecide?: boolean;
}) {
  return (
    <div className="grid gap-4">
      {showForm && <DoctorLeaveForm doctorId={doctorId} />}
      {leaveDays.length === 0 ? (
        <EmptyState icon={CalendarOff} message="No upcoming leave days scheduled." />
      ) : (
        <div className="grid gap-2">
          {leaveDays.map((leave) => (
            <div
              key={leave.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">
                    {leave.date.toLocaleDateString(undefined, {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                  {leave.status === "PENDING" && (
                    <Badge variant="outline" className="bg-amber-100 text-amber-700">
                      Pending approval
                    </Badge>
                  )}
                </div>
                {leave.reason && <p className="text-sm text-muted-foreground">{leave.reason}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {canDecide && leave.status === "PENDING" && (
                  <>
                    <form action={approveDoctorLeave.bind(null, leave.id)}>
                      <Button
                        size="sm"
                        variant="outline"
                        type="submit"
                        className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                      >
                        Approve
                      </Button>
                    </form>
                    <form action={rejectDoctorLeave.bind(null, leave.id)} className="flex items-center gap-1">
                      <Input name="note" placeholder="Reason (optional)" className="h-8 w-40" />
                      <Button
                        size="sm"
                        variant="outline"
                        type="submit"
                        className="border-red-200 text-red-700 hover:bg-red-50"
                      >
                        Reject
                      </Button>
                    </form>
                  </>
                )}
                <form action={removeDoctorLeave.bind(null, leave.id)}>
                  <Button size="sm" variant="destructive" type="submit">
                    Remove
                  </Button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import { Clock3, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requirePageRole, STAFF_ROLES } from "@/lib/authz";
import { todayRange } from "@/lib/queue";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { ClockButton } from "@/components/attendance/clock-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function formatDuration(start: Date, end: Date | null) {
  const ms = (end ?? new Date()).getTime() - start.getTime();
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

export default async function AttendancePage() {
  const session = await requirePageRole(STAFF_ROLES);
  const t = await getTranslations("attendance");
  const { start, end } = todayRange();

  const [openRecord, myRecent, todayAll] = await Promise.all([
    prisma.attendanceRecord.findFirst({
      where: { userId: session.user.id, clockOut: null },
    }),
    prisma.attendanceRecord.findMany({
      where: { userId: session.user.id },
      orderBy: { clockIn: "desc" },
      take: 14,
    }),
    session.user.role === "ADMIN"
      ? prisma.attendanceRecord.findMany({
          where: { clockIn: { gte: start, lt: end } },
          include: { user: true },
          orderBy: { clockIn: "asc" },
        })
      : Promise.resolve(null),
  ]);

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>

      <Card>
        <CardContent className="flex items-center justify-between gap-4 pt-6">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
              <Clock3 className="size-5" />
            </div>
            <div>
              <p className="font-semibold">
                {openRecord ? t("clockedInSince", { time: openRecord.clockIn.toLocaleTimeString() }) : t("notClockedIn")}
              </p>
              {openRecord && (
                <p className="text-sm text-muted-foreground">
                  {formatDuration(openRecord.clockIn, null)}
                </p>
              )}
            </div>
          </div>
          <ClockButton isClockedIn={!!openRecord} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("myHistory")}</CardTitle>
        </CardHeader>
        <CardContent>
          {myRecent.length === 0 ? (
            <EmptyState icon={Clock3} message={t("noHistory")} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("date")}</TableHead>
                  <TableHead>{t("clockIn")}</TableHead>
                  <TableHead>{t("clockOut")}</TableHead>
                  <TableHead>{t("duration")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {myRecent.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>{record.clockIn.toLocaleDateString()}</TableCell>
                    <TableCell>{record.clockIn.toLocaleTimeString()}</TableCell>
                    <TableCell>
                      {record.clockOut ? (
                        record.clockOut.toLocaleTimeString()
                      ) : (
                        <Badge variant="outline">{t("inProgress")}</Badge>
                      )}
                    </TableCell>
                    <TableCell>{formatDuration(record.clockIn, record.clockOut)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {todayAll && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-4" />
              {t("todayAllStaff")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {todayAll.length === 0 ? (
              <EmptyState icon={Users} message={t("noHistory")} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("staffMember")}</TableHead>
                    <TableHead>{t("clockIn")}</TableHead>
                    <TableHead>{t("clockOut")}</TableHead>
                    <TableHead>{t("duration")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {todayAll.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        {record.user.name} <span className="text-muted-foreground">({record.user.role})</span>
                      </TableCell>
                      <TableCell>{record.clockIn.toLocaleTimeString()}</TableCell>
                      <TableCell>
                        {record.clockOut ? (
                          record.clockOut.toLocaleTimeString()
                        ) : (
                          <Badge variant="outline">{t("inProgress")}</Badge>
                        )}
                      </TableCell>
                      <TableCell>{formatDuration(record.clockIn, record.clockOut)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

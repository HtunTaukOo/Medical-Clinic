import { History } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { BackLink } from "@/components/back-link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function ActivityLogPage() {
  await requirePageRole(["ADMIN"]);
  const t = await getTranslations("activityLog");

  const entries = await prisma.activityLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="grid gap-4">
      <div>
        <BackLink href="/staff" label={t("back")} />
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("description")}
        </p>
      </div>

      {entries.length === 0 ? (
        <EmptyState icon={History} message={t("empty")} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("date")}</TableHead>
              <TableHead>{t("actor")}</TableHead>
              <TableHead>{t("action")}</TableHead>
              <TableHead>{t("target")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                  {new Date(entry.createdAt).toLocaleString()}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{entry.actorName}</span>
                    <Badge variant="outline">{entry.actorRole}</Badge>
                  </div>
                </TableCell>
                <TableCell>{entry.action}</TableCell>
                <TableCell className="text-muted-foreground">
                  {entry.target ?? "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

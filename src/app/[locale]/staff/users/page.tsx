import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { toggleStaffActive } from "@/actions/staff";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function StaffUsersPage() {
  await requireRole(["ADMIN"]);
  const t = await getTranslations("staff");

  const staff = await prisma.user.findMany({
    where: { role: { not: "PATIENT" } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <Button asChild>
          <Link href="/staff/users/new">{t("new")}</Link>
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("name")}</TableHead>
            <TableHead>{t("email")}</TableHead>
            <TableHead>{t("role")}</TableHead>
            <TableHead>{t("active")}</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {staff.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground">
                {t("noResults")}
              </TableCell>
            </TableRow>
          )}
          {staff.map((user) => (
            <TableRow key={user.id}>
              <TableCell>{user.name}</TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell>
                <Badge variant="outline">{user.role}</Badge>
              </TableCell>
              <TableCell>{user.active ? "Yes" : "No"}</TableCell>
              <TableCell className="text-right">
                <form action={toggleStaffActive.bind(null, user.id)}>
                  <Button size="sm" variant={user.active ? "destructive" : "secondary"} type="submit">
                    {user.active ? t("deactivate") : t("activate")}
                  </Button>
                </form>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

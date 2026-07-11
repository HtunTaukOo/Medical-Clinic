import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function PatientsPage() {
  await requireRole(["ADMIN", "DOCTOR", "RECEPTIONIST"]);
  const t = await getTranslations("patients");

  const patients = await prisma.patient.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <Button asChild>
          <Link href="/staff/patients/new">{t("new")}</Link>
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("name")}</TableHead>
            <TableHead>{t("phone")}</TableHead>
            <TableHead>{t("email")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {patients.length === 0 && (
            <TableRow>
              <TableCell colSpan={3} className="text-muted-foreground">
                {t("noResults")}
              </TableCell>
            </TableRow>
          )}
          {patients.map((patient) => (
            <TableRow key={patient.id}>
              <TableCell>
                <Link
                  href={`/staff/patients/${patient.id}`}
                  className="underline"
                >
                  {patient.name}
                </Link>
              </TableCell>
              <TableCell>{patient.phone}</TableCell>
              <TableCell>{patient.email}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

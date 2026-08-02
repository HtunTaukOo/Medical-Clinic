import { ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function ClaimsPage() {
  await requireRole(["ADMIN", "RECEPTIONIST"]);
  const t = await getTranslations("billing");

  const claims = await prisma.insuranceClaim.findMany({
    orderBy: { submittedAt: "desc" },
    include: { patient: true },
  });

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">{t("insuranceClaims")}</h1>

      {claims.length === 0 ? (
        <EmptyState icon={ShieldCheck} message={t("noClaims")} />
      ) : (
        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("patient")}</TableHead>
                  <TableHead>{t("insuranceProvider")}</TableHead>
                  <TableHead>{t("policyNumber")}</TableHead>
                  <TableHead>{t("claimedAmount")}</TableHead>
                  <TableHead>{t("approvedAmount")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("submitted")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {claims.map((claim) => (
                  <TableRow key={claim.id}>
                    <TableCell>
                      <Link
                        href={`/staff/billing/${claim.invoiceId}`}
                        className="underline underline-offset-2"
                      >
                        {claim.patient.name}
                      </Link>
                    </TableCell>
                    <TableCell>{claim.insuranceProvider}</TableCell>
                    <TableCell>{claim.policyNumber}</TableCell>
                    <TableCell>{Number(claim.claimedAmount).toFixed(2)}</TableCell>
                    <TableCell>
                      {claim.approvedAmount != null
                        ? Number(claim.approvedAmount).toFixed(2)
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={claim.status === "PAID" ? "default" : "outline"}>
                        {claim.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(claim.submittedAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

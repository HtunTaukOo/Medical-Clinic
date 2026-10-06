import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/authz";
import { enterExternalLabReferralResults } from "@/actions/external-lab";
import { ResultEntryForm } from "@/components/lab/result-entry-form";
import { BackLink } from "@/components/back-link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getTranslations } from "next-intl/server";

export default async function ExternalLabReferralDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageRole(["ADMIN", "STAFF"]);
  const t = await getTranslations("staffLab");
  const { id } = await params;

  const referral = await prisma.externalLabReferral.findUnique({
    where: { id },
    include: { patient: true, items: { include: { labTest: true } } },
  });

  if (!referral) notFound();

  const resultsEntered = referral.items.every((item) => item.resultEnteredAt);

  return (
    <div className="grid gap-6">
      <BackLink href="/staff/lab?tab=external" />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{referral.patient.name}</h1>
          <p className="text-muted-foreground">{t("referredTo", { name: referral.referredLabName })}</p>
        </div>
        <Badge variant="outline">{referral.status}</Badge>
      </div>

      {referral.status === "SENDING" && (
        <Card>
          <CardContent className="text-muted-foreground">
            {t("receiveBeforeResults")}
          </CardContent>
        </Card>
      )}

      {referral.status === "RECEIVED" && !resultsEntered && (
        <Card>
          <CardHeader>
            <CardTitle>{t("enterResults")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResultEntryForm
              action={enterExternalLabReferralResults.bind(null, referral.id)}
              items={referral.items.map((item) => ({
                id: item.id,
                labTest: {
                  name: item.labTest.name,
                  unit: item.labTest.unit,
                  normalRange: item.labTest.normalRange,
                },
              }))}
              showDocumentUpload
            />
          </CardContent>
        </Card>
      )}

      {referral.status === "RECEIVED" && resultsEntered && (
        <Card>
          <CardHeader>
            <CardTitle>{t("results")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {referral.items.map((item) => (
              <div key={item.id} className="rounded-md border p-3">
                <p className="font-medium">{item.labTest.name}</p>
                <p className="text-sm">
                  {t("result", { value: item.resultValue ?? "—" })}
                  {item.labTest.unit && item.resultValue ? ` ${item.labTest.unit}` : ""}
                </p>
                {item.labTest.normalRange && (
                  <p className="text-sm text-muted-foreground">
                    {t("normalRange", { range: item.labTest.normalRange })}
                  </p>
                )}
                {item.resultNote && (
                  <p className="text-sm text-muted-foreground">{t("note", { note: item.resultNote })}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {referral.status === "CANCELLED" && (
        <Card>
          <CardContent className="text-muted-foreground">{t("referralCancelled")}</CardContent>
        </Card>
      )}
    </div>
  );
}

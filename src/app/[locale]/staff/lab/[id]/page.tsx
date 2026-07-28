import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { collectSample } from "@/actions/lab";
import { ResultEntryForm } from "@/components/lab/result-entry-form";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function LabOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["ADMIN", "LAB_TECH"]);
  const { id } = await params;

  const order = await prisma.labOrder.findUnique({
    where: { id },
    include: {
      patient: true,
      doctor: { include: { user: true } },
      items: { include: { labTest: true } },
    },
  });

  if (!order) notFound();

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{order.patient.name}</h1>
          <p className="text-muted-foreground">Ordered by {order.doctor.user.name}</p>
        </div>
        <Badge variant="outline">{order.status.replace("_", " ")}</Badge>
      </div>

      {order.status === "ORDERED" && (
        <Card>
          <CardContent className="flex items-center justify-between">
            <p className="text-muted-foreground">Waiting for sample collection.</p>
            <form action={collectSample.bind(null, order.id)}>
              <Button type="submit">Collect sample</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {order.status === "SAMPLE_COLLECTED" && (
        <Card>
          <CardHeader>
            <CardTitle>Enter results</CardTitle>
          </CardHeader>
          <CardContent>
            <ResultEntryForm
              labOrderId={order.id}
              items={order.items.map((item) => ({
                id: item.id,
                labTest: {
                  name: item.labTest.name,
                  unit: item.labTest.unit,
                  normalRange: item.labTest.normalRange,
                },
              }))}
            />
          </CardContent>
        </Card>
      )}

      {order.status === "COMPLETED" && (
        <Card>
          <CardHeader>
            <CardTitle>Results</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {order.items.map((item) => (
              <div key={item.id} className="rounded-md border p-3">
                <p className="font-medium">{item.labTest.name}</p>
                <p className="text-sm">
                  Result: {item.resultValue ?? "—"}
                  {item.labTest.unit && item.resultValue ? ` ${item.labTest.unit}` : ""}
                </p>
                {item.labTest.normalRange && (
                  <p className="text-sm text-muted-foreground">
                    Normal range: {item.labTest.normalRange}
                  </p>
                )}
                {item.resultNote && (
                  <p className="text-sm text-muted-foreground">Note: {item.resultNote}</p>
                )}
              </div>
            ))}
            <Button asChild variant="outline" className="w-fit">
              <Link href={`/lab-report/${order.id}`}>Print report</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

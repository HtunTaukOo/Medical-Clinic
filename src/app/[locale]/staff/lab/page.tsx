import { FlaskConical, ClipboardList } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/authz";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { collectSample } from "@/actions/lab";

const STATUS_STYLES: Record<string, string> = {
  ORDERED: "bg-amber-100 text-amber-800",
  SAMPLE_COLLECTED: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-rose-100 text-rose-800",
};

export default async function LabPage() {
  await requirePageRole(["ADMIN", "LAB_TECH"]);

  const [pendingOrders, tests] = await Promise.all([
    prisma.labOrder.findMany({
      where: { status: { in: ["ORDERED", "SAMPLE_COLLECTED"] } },
      include: {
        patient: true,
        doctor: { include: { user: true } },
        items: { include: { labTest: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.labTest.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">Laboratory</h1>

      <Card>
        <CardHeader>
          <CardTitle>Pending Orders</CardTitle>
        </CardHeader>
        <CardContent>
          {pendingOrders.length === 0 ? (
            <EmptyState icon={ClipboardList} message="No pending lab orders." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {pendingOrders.map((order) => (
                <Card key={order.id} className="border-muted-foreground/20">
                  <CardContent className="grid gap-3">
                    <div className="flex items-center justify-between gap-2">
                      <Link
                        href={`/staff/patients/${order.patientId}`}
                        className="font-medium underline"
                      >
                        {order.patient.name}
                      </Link>
                      <Badge className={STATUS_STYLES[order.status]}>
                        {order.status.replace("_", " ")}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Ordered by {order.doctor.user.name}
                    </p>
                    <ul className="text-sm">
                      {order.items.map((item) => (
                        <li key={item.id}>{item.labTest.name}</li>
                      ))}
                    </ul>
                    {order.status === "ORDERED" ? (
                      <form action={collectSample.bind(null, order.id)}>
                        <Button size="sm" type="submit">
                          Collect sample
                        </Button>
                      </form>
                    ) : (
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/staff/lab/${order.id}`}>Enter results</Link>
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Test Catalog</h2>
        <Button asChild size="sm">
          <Link href="/staff/lab-tests/new">New test</Link>
        </Button>
      </div>

      {tests.length === 0 ? (
        <EmptyState icon={FlaskConical} message="No lab tests in the catalog yet." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tests.map((test) => (
            <Card key={test.id}>
              <CardContent className="grid gap-2">
                <div className="flex items-center gap-3">
                  <div className="flex size-11 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                    <FlaskConical className="size-5" />
                  </div>
                  <div>
                    <p className="font-semibold">{test.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {Number(test.price).toFixed(2)}
                      {test.unit && ` — ${test.unit}`}
                    </p>
                  </div>
                </div>
                {test.normalRange && (
                  <p className="text-sm text-muted-foreground">
                    Normal range: {test.normalRange}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

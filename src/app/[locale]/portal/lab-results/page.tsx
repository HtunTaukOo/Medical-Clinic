import { FlaskConical } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";

export default async function PortalLabResultsPage() {
  const session = await auth();
  const patientId = session?.user.patientId;

  const orders = patientId
    ? await prisma.labOrder.findMany({
        where: { patientId, status: "COMPLETED" },
        include: { doctor: { include: { user: true } }, items: { include: { labTest: true } } },
        orderBy: { completedAt: "desc" },
      })
    : [];

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-semibold">Lab Results</h1>

      {orders.length === 0 ? (
        <EmptyState icon={FlaskConical} message="No lab results yet." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {orders.map((order) => (
            <Link key={order.id} href={`/lab-report/${order.id}`}>
              <Card className="h-full transition-colors hover:bg-muted/50">
                <CardContent className="grid gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">
                      {order.completedAt && new Date(order.completedAt).toLocaleDateString()}
                    </p>
                    <Badge variant="default">Completed</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Ordered by {order.doctor.user.name}
                  </p>
                  <ul className="text-sm text-muted-foreground">
                    {order.items.map((item) => (
                      <li key={item.id}>{item.labTest.name}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

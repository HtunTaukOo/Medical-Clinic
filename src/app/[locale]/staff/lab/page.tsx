import { FlaskConical, ClipboardList, History as HistoryIcon } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/authz";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { collectSample } from "@/actions/lab";
import { NewLabOrderForm } from "@/components/lab/new-lab-order-form";

const STATUS_STYLES: Record<string, string> = {
  ORDERED: "bg-amber-100 text-amber-800",
  SAMPLE_COLLECTED: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-rose-100 text-rose-800",
};

const TABS = [
  { value: "new", label: "New Test" },
  { value: "orders", label: "Orders" },
  { value: "catalog", label: "Test Catalog" },
  { value: "history", label: "History" },
] as const;
type Tab = (typeof TABS)[number]["value"];

export default async function LabPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requirePageRole(["ADMIN", "STAFF"]);
  const { tab: tabParam } = await searchParams;
  const tab: Tab = TABS.some(({ value }) => value === tabParam) ? (tabParam as Tab) : "new";

  const [activeOrders, historyOrders, tests, patients, doctors] = await Promise.all([
    tab === "orders"
      ? prisma.labOrder.findMany({
          where: { status: { in: ["ORDERED", "SAMPLE_COLLECTED"] } },
          include: {
            patient: true,
            doctor: { include: { user: true } },
            items: { include: { labTest: true } },
          },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
    tab === "history"
      ? prisma.labOrder.findMany({
          where: { status: { in: ["COMPLETED", "CANCELLED"] } },
          include: {
            patient: true,
            doctor: { include: { user: true } },
            items: { include: { labTest: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 200,
        })
      : Promise.resolve([]),
    tab === "new" || tab === "catalog"
      ? prisma.labTest.findMany({ orderBy: { name: "asc" } })
      : Promise.resolve([]),
    tab === "new" ? prisma.patient.findMany({ orderBy: { name: "asc" } }) : Promise.resolve([]),
    tab === "new"
      ? prisma.doctorProfile.findMany({ include: { user: true }, orderBy: { user: { name: "asc" } } })
      : Promise.resolve([]),
  ]);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Laboratory</h1>
        <p className="text-sm text-muted-foreground">Manage lab test orders and results.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map(({ value, label }) => (
          <Button key={value} asChild variant={tab === value ? "default" : "outline"} size="sm">
            <Link href={`/staff/lab?tab=${value}`}>{label}</Link>
          </Button>
        ))}
      </div>

      {tab === "new" && (
        <NewLabOrderForm
          patients={patients.map((p) => ({ id: p.id, name: p.name }))}
          doctors={doctors.map((d) => ({ id: d.id, name: d.user.name }))}
          tests={tests.map((t) => ({
            id: t.id,
            name: t.name,
            unit: t.unit,
            normalRange: t.normalRange,
            price: Number(t.price),
          }))}
        />
      )}

      {tab === "orders" &&
        (activeOrders.length === 0 ? (
          <EmptyState icon={ClipboardList} message="No pending lab orders." />
        ) : (
          <Card>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Doctor</TableHead>
                    <TableHead>Tests</TableHead>
                    <TableHead>Ordered</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/staff/patients/${order.patientId}`}
                          className="underline underline-offset-2"
                        >
                          {order.patient.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {order.doctor.user.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {order.items.map((i) => i.labTest.name).join(", ")}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {order.createdAt.toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_STYLES[order.status]}>
                          {order.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {order.status === "ORDERED" ? (
                          <form action={collectSample.bind(null, order.id)} className="inline">
                            <button
                              type="submit"
                              className="font-medium text-primary underline underline-offset-2"
                            >
                              Collect sample
                            </button>
                          </form>
                        ) : (
                          <Link
                            href={`/staff/lab/${order.id}`}
                            className="font-medium text-primary underline underline-offset-2"
                          >
                            Enter results
                          </Link>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}

      {tab === "catalog" && (
        <div className="grid gap-4">
          <div className="flex items-center justify-end">
            <Button asChild size="sm">
              <Link href="/staff/lab-tests/new">Add Test Type</Link>
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
                      <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
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
      )}

      {tab === "history" &&
        (historyOrders.length === 0 ? (
          <EmptyState icon={HistoryIcon} message="No completed lab orders yet." />
        ) : (
          <Card>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Doctor</TableHead>
                    <TableHead>Tests</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {order.createdAt.toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="font-medium">{order.patient.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {order.doctor.user.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {order.items.map((i) => i.labTest.name).join(", ")}
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_STYLES[order.status]}>
                          {order.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-3">
                          <Link
                            href={`/staff/lab/${order.id}`}
                            className="font-medium text-primary underline underline-offset-2"
                          >
                            View
                          </Link>
                          {order.status === "COMPLETED" && (
                            <Link
                              href={`/lab-report/${order.id}`}
                              className="font-medium text-primary underline underline-offset-2"
                            >
                              Report
                            </Link>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
    </div>
  );
}

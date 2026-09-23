import { FlaskConical, ClipboardList, History as HistoryIcon, FileText } from "lucide-react";
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
import { markExternalLabReferralReceived, cancelExternalLabReferral } from "@/actions/external-lab";
import { NewLabOrderForm } from "@/components/lab/new-lab-order-form";
import { NewExternalLabReferralForm } from "@/components/lab/new-external-lab-referral-form";
import { DeleteLabTestButton } from "@/components/lab/delete-lab-test-button";
import { LAB_TEST_CATEGORIES, LAB_TEST_CATEGORY_LABELS } from "@/lib/lab-categories";
import { TabTransitionScope, TabButton, TabTransitionContent } from "@/components/tab-transition";
import { calculateAge } from "@/lib/format";

const STATUS_STYLES: Record<string, string> = {
  ORDERED: "bg-amber-100 text-amber-800",
  SAMPLE_COLLECTED: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-rose-100 text-rose-800",
  SENDING: "bg-amber-100 text-amber-800",
  RECEIVED: "bg-emerald-100 text-emerald-800",
};

const TABS = [
  { value: "new", label: "New Test" },
  { value: "orders", label: "Orders" },
  { value: "external", label: "External Lab Test" },
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

  const [
    activeOrders,
    historyOrders,
    tests,
    patients,
    doctors,
    serviceSpecialties,
    externalReferrals,
    referredLabNameRows,
  ] = await Promise.all([
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
    tab === "new" || tab === "catalog" || tab === "external"
      ? prisma.labTest.findMany({ orderBy: { name: "asc" } })
      : Promise.resolve([]),
    tab === "new" || tab === "external"
      ? prisma.patient.findMany({ orderBy: { name: "asc" } })
      : Promise.resolve([]),
    tab === "new"
      ? prisma.doctorProfile.findMany({ include: { user: true }, orderBy: { user: { name: "asc" } } })
      : Promise.resolve([]),
    tab === "new"
      ? prisma.specialty.findMany({ where: { bookingMode: "SERVICE_CAPACITY" }, select: { name: true } })
      : Promise.resolve([]),
    tab === "external"
      ? prisma.externalLabReferral.findMany({
          include: { patient: true, items: { include: { labTest: true } } },
          orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        })
      : Promise.resolve([]),
    tab === "external"
      ? prisma.externalLabReferral.findMany({
          distinct: ["referredLabName"],
          orderBy: { referredLabName: "asc" },
          select: { referredLabName: true },
        })
      : Promise.resolve([]),
  ]);

  // SERVICE_CAPACITY specialties (e.g. Lab Visit) are backed by a placeholder
  // DoctorProfile — not a real ordering physician, so it's excluded here.
  const serviceSpecialtyNames = new Set(serviceSpecialties.map((s) => s.name));
  const orderingDoctors = doctors.filter((d) => !d.specialty || !serviceSpecialtyNames.has(d.specialty));

  return (
    <TabTransitionScope>
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Laboratory</h1>
        <p className="text-sm text-muted-foreground">Manage lab test orders and results.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map(({ value, label }) => (
          <TabButton key={value} href={`/staff/lab?tab=${value}`} active={tab === value} size="sm">
            {label}
          </TabButton>
        ))}
      </div>

      <TabTransitionContent className="grid gap-6">
      {tab === "new" && (
        <NewLabOrderForm
          patients={patients.map((p) => ({ id: p.id, name: p.name }))}
          doctors={orderingDoctors.map((d) => ({ id: d.id, name: d.user.name }))}
          tests={tests.map((t) => ({
            id: t.id,
            name: t.name,
            unit: t.unit,
            normalRange: t.normalRange,
            price: Number(t.price),
            category: t.category,
            requiresExternalLab: t.requiresExternalLab,
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

      {tab === "external" && (
        <div className="grid gap-6">
          <NewExternalLabReferralForm
            patients={patients.map((p) => ({ id: p.id, name: p.name }))}
            tests={tests.map((t) => ({
              id: t.id,
              name: t.name,
              normalRange: t.normalRange,
              category: t.category,
              requiresExternalLab: t.requiresExternalLab,
            }))}
            referredLabNames={referredLabNameRows.map((r) => r.referredLabName)}
          />

          {externalReferrals.length === 0 ? (
            <EmptyState icon={FlaskConical} message="No external lab referrals yet." />
          ) : (
            <Card>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Age</TableHead>
                      <TableHead>ID</TableHead>
                      <TableHead>Requested test</TableHead>
                      <TableHead>Refer lab</TableHead>
                      <TableHead>Sample collected time</TableHead>
                      <TableHead>Requested time</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {externalReferrals.map((referral) => (
                      <TableRow key={referral.id}>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {referral.createdAt.toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </TableCell>
                        <TableCell className="font-medium">
                          <Link
                            href={`/staff/patients/${referral.patientId}`}
                            className="underline underline-offset-2"
                          >
                            {referral.patient.name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {calculateAge(referral.patient.dob) ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {referral.patient.patientCode ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {referral.items.map((i) => i.labTest.name).join(", ")}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            {referral.referredLabName}
                            {referral.documentName && (
                              <a
                                href={`/api/external-lab-referrals/${referral.id}/file`}
                                target="_blank"
                                rel="noreferrer"
                                title={referral.documentName}
                                className="text-primary hover:text-primary/80"
                              >
                                <FileText className="size-4" />
                              </a>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {referral.sampleCollectedAt.toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {referral.requestedAt.toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </TableCell>
                        <TableCell>
                          <Badge className={STATUS_STYLES[referral.status]}>
                            {referral.status === "SENDING"
                              ? "Sending"
                              : referral.status === "RECEIVED"
                                ? "Received"
                                : "Cancelled"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {referral.status === "SENDING" ? (
                            <div className="flex items-center justify-end gap-3">
                              <form action={markExternalLabReferralReceived.bind(null, referral.id)} className="inline">
                                <button
                                  type="submit"
                                  className="font-medium text-primary underline underline-offset-2"
                                >
                                  Mark Received
                                </button>
                              </form>
                              <form action={cancelExternalLabReferral.bind(null, referral.id)} className="inline">
                                <button
                                  type="submit"
                                  className="font-medium text-destructive underline underline-offset-2"
                                >
                                  Cancel
                                </button>
                              </form>
                            </div>
                          ) : referral.status === "RECEIVED" &&
                            !referral.items.every((i) => i.resultEnteredAt) ? (
                            <Link
                              href={`/staff/lab/external/${referral.id}`}
                              className="font-medium text-primary underline underline-offset-2"
                            >
                              Enter results
                            </Link>
                          ) : (
                            <span className="whitespace-nowrap text-muted-foreground">
                              {referral.status === "RECEIVED" ? referral.receivedByName : referral.cancelledByName}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      )}

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
            <div className="grid gap-6">
              {LAB_TEST_CATEGORIES.map((category) => {
                const testsInCategory = tests.filter((t) => t.category === category);
                if (testsInCategory.length === 0) return null;
                return (
                  <div key={category} className="grid gap-3">
                    <h3 className="text-sm font-semibold text-foreground">
                      {LAB_TEST_CATEGORY_LABELS[category]}{" "}
                      <span className="font-normal text-muted-foreground">
                        ({testsInCategory.length})
                      </span>
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {testsInCategory.map((test) => (
                        <Card key={test.id}>
                          <CardContent className="grid gap-2">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                                  <FlaskConical className="size-5" />
                                </div>
                                <div>
                                  <p className="font-semibold">{test.name}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {Number(test.price).toFixed(2)}
                                    {test.unit && ` — ${test.unit}`}
                                  </p>
                                  {test.requiresExternalLab && (
                                    <Badge
                                      variant="outline"
                                      className="mt-1 w-fit border-amber-300 text-amber-700"
                                    >
                                      Sent Externally
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <div className="grid justify-items-end gap-1">
                                <Link
                                  href={`/staff/lab-tests/${test.id}/edit`}
                                  className="text-sm font-medium text-primary underline underline-offset-2"
                                >
                                  Edit
                                </Link>
                                <DeleteLabTestButton testId={test.id} name={test.name} />
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
                  </div>
                );
              })}
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
      </TabTransitionContent>
    </div>
    </TabTransitionScope>
  );
}

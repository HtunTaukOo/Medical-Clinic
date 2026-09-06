import { Receipt } from "lucide-react";
import { getTranslations } from "next-intl/server";
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
import { InvoiceForm } from "@/components/billing/invoice-form";

function formatKyat(value: number) {
  return `K ${Math.round(value).toLocaleString()}`;
}

const TABS = [
  { value: "new", label: "New Bill" },
  { value: "UNPAID", label: "Unpaid" },
  { value: "PARTIAL", label: "Partially Paid" },
  { value: "PAID", label: "Paid" },
  { value: "REFUNDED", label: "Refunded" },
] as const;
type Tab = (typeof TABS)[number]["value"];

const STATUS_STYLES: Record<string, string> = {
  UNPAID: "bg-rose-100 text-rose-700",
  PARTIAL: "bg-amber-100 text-amber-700",
  PAID: "bg-emerald-100 text-emerald-700",
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requirePageRole(["ADMIN", "STAFF"]);
  const t = await getTranslations("billing");
  const { tab: tabParam } = await searchParams;
  const tab: Tab = TABS.some(({ value }) => value === tabParam) ? (tabParam as Tab) : "new";

  const [invoices, patients, invoiceCount] = await Promise.all([
    prisma.invoice.findMany({
      orderBy: { createdAt: "desc" },
      include: { patient: true, payments: { include: { refunds: true } } },
    }),
    tab === "new" ? prisma.patient.findMany({ orderBy: { name: "asc" } }) : Promise.resolve([]),
    tab === "new" ? prisma.invoice.count() : Promise.resolve(0),
  ]);

  const rows = invoices.map((invoice) => {
    const paid = invoice.payments.reduce((sum, p) => {
      const refunded = p.refunds.reduce((s, r) => s + Number(r.amount), 0);
      return sum + Number(p.amount) - refunded;
    }, 0);
    const hasRefund = invoice.payments.some((p) => p.refunds.length > 0);
    const balanceDue = Math.max(0, Number(invoice.total) - paid);
    return { invoice, balanceDue, hasRefund };
  });

  const tabCounts: Record<Tab, number> = {
    new: 0,
    UNPAID: rows.filter((r) => r.invoice.status === "UNPAID").length,
    PARTIAL: rows.filter((r) => r.invoice.status === "PARTIAL").length,
    PAID: rows.filter((r) => r.invoice.status === "PAID" && !r.hasRefund).length,
    REFUNDED: rows.filter((r) => r.hasRefund).length,
  };

  const visibleRows =
    tab === "new"
      ? []
      : tab === "REFUNDED"
        ? rows.filter((r) => r.hasRefund)
        : rows.filter((r) => r.invoice.status === tab && !r.hasRefund);

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">Create invoices and manage payments.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/staff/billing/claims">{t("insuranceClaims")}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/staff/billing/packages">{t("packages")}</Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map(({ value, label }) => (
          <Button key={value} asChild variant={tab === value ? "default" : "outline"} size="sm">
            <Link href={`/staff/billing?tab=${value}`}>
              {label}
              {value !== "new" && (
                <Badge
                  variant="secondary"
                  className={tab === value ? "bg-white/20 text-white" : undefined}
                >
                  {tabCounts[value]}
                </Badge>
              )}
            </Link>
          </Button>
        ))}
      </div>

      {tab === "new" ? (
        <InvoiceForm
          patients={patients.map((p) => ({ id: p.id, name: p.name }))}
          nextInvoiceNumber={invoiceCount + 1}
        />
      ) : visibleRows.length === 0 ? (
        <EmptyState icon={Receipt} message={t("noResults")} />
      ) : (
        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Balance Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.map(({ invoice, balanceDue }) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">{invoice.patient.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {invoice.createdAt.toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell>{formatKyat(Number(invoice.total))}</TableCell>
                    <TableCell>{formatKyat(balanceDue)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_STYLES[invoice.status]}>
                        {invoice.status === "PAID"
                          ? "Paid"
                          : invoice.status === "PARTIAL"
                            ? "Partial"
                            : "Unpaid"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/staff/billing/${invoice.id}`}
                        className="font-medium text-primary underline underline-offset-2"
                      >
                        View
                      </Link>
                    </TableCell>
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

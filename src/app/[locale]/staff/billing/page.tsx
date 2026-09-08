import { Plus, Receipt } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/authz";
import { clinicMidnight } from "@/lib/clinic-hours";
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

function formatKyat(value: number) {
  return `K ${Math.round(value).toLocaleString()}`;
}

const TABS = [
  { value: "all", label: "All Invoices" },
  { value: "UNPAID", label: "Unpaid" },
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
  const tab: Tab = TABS.some(({ value }) => value === tabParam) ? (tabParam as Tab) : "all";

  const todayStart = clinicMidnight(new Date());
  const todayEnd = new Date(todayStart.getTime() + 86400000);

  const [invoicesAsc, todaysPayments, paidInvoicesToday] = await Promise.all([
    prisma.invoice.findMany({
      orderBy: { createdAt: "asc" },
      include: { patient: true, items: true, payments: { include: { refunds: true } } },
    }),
    prisma.payment.findMany({
      where: { paidAt: { gte: todayStart, lt: todayEnd } },
      select: { amount: true },
    }),
    prisma.invoice.count({
      where: { status: "PAID", payments: { some: { paidAt: { gte: todayStart, lt: todayEnd } } } },
    }),
  ]);

  const totalRevenueToday = todaysPayments.reduce((sum, p) => sum + Number(p.amount), 0);

  const rows = invoicesAsc.map((invoice, index) => {
    const grossPaid = invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const totalRefunded = invoice.payments.reduce(
      (sum, p) => sum + p.refunds.reduce((s, r) => s + Number(r.amount), 0),
      0
    );
    const netPaid = grossPaid - totalRefunded;
    const balanceDue = Math.max(0, Number(invoice.total) - netPaid);
    const hasRefund = totalRefunded > 0;
    const description = invoice.items.map((i) => i.description).join(" + ") || "—";
    return {
      invoice,
      invoiceNumber: index + 1,
      description,
      grossPaid,
      netPaid,
      balanceDue,
      hasRefund,
    };
  });
  rows.reverse();

  const visibleRows =
    tab === "all"
      ? rows
      : tab === "REFUNDED"
        ? rows.filter((r) => r.hasRefund)
        : tab === "UNPAID"
          ? rows.filter((r) => !r.hasRefund && (r.invoice.status === "UNPAID" || r.invoice.status === "PARTIAL"))
          : rows.filter((r) => r.invoice.status === "PAID" && !r.hasRefund);

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">Manage invoices and payments.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/staff/billing/claims">{t("insuranceClaims")}</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/staff/billing/packages">{t("packages")}</Link>
          </Button>
          <Button asChild>
            <Link href="/staff/billing/new">
              <Plus />
              New Invoice
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 p-6 text-white">
        <div>
          <p className="text-xs font-semibold tracking-wide text-emerald-50 uppercase">
            Total Revenue (Today)
          </p>
          <p className="mt-1 text-3xl font-bold">{formatKyat(totalRevenueToday)}</p>
          <p className="mt-1 text-sm text-emerald-50">
            {paidInvoicesToday} paid invoice{paidInvoicesToday === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white">
          <Receipt className="size-5" />
        </div>
      </div>

      <div className="inline-flex w-fit items-center gap-1 rounded-xl bg-muted p-1">
        {TABS.map(({ value, label }) => (
          <Link
            key={value}
            href={`/staff/billing?tab=${value}`}
            className={
              tab === value
                ? "rounded-lg bg-card px-4 py-2 text-sm font-medium text-primary shadow-sm"
                : "rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
            }
          >
            {label}
          </Link>
        ))}
      </div>

      {visibleRows.length === 0 ? (
        <EmptyState icon={Receipt} message={t("noResults")} />
      ) : (
        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice No</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.map(({ invoice, invoiceNumber, description, grossPaid, netPaid, balanceDue, hasRefund }) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">
                      INV-{String(invoiceNumber).padStart(4, "0")}
                    </TableCell>
                    <TableCell className="font-medium">{invoice.patient.name}</TableCell>
                    <TableCell className="text-muted-foreground">{description}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {invoice.createdAt.toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell>{formatKyat(Number(invoice.total))}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1">
                        <Badge variant="outline" className={STATUS_STYLES[invoice.status]}>
                          {invoice.status === "PAID"
                            ? "Paid"
                            : invoice.status === "PARTIAL"
                              ? "Partial"
                              : "Unpaid"}
                        </Badge>
                        {hasRefund && (
                          <Badge variant="outline" className="bg-slate-100 text-slate-600">
                            {t("refunded")}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-3">
                        {balanceDue > 0 && (
                          <Link
                            href={`/staff/billing/${invoice.id}`}
                            className="font-medium text-emerald-600 hover:underline"
                          >
                            Receive Payment
                          </Link>
                        )}
                        {grossPaid > 0 && (
                          <>
                            <Link
                              href={`/receipt/${invoice.id}`}
                              className="font-medium text-primary hover:underline"
                            >
                              View Receipt
                            </Link>
                            {netPaid > 0 && (
                              <Link
                                href={`/staff/billing/${invoice.id}`}
                                className="font-medium text-rose-600 hover:underline"
                              >
                                {t("refund")}
                              </Link>
                            )}
                          </>
                        )}
                      </div>
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

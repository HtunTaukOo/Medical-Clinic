import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getClinicSettings } from "@/lib/clinic-hours";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InvoiceAccordion, type InvoiceRecord } from "@/components/billing/invoice-accordion";
import { PayNowDialog } from "@/components/billing/pay-now-dialog";
import { Button } from "@/components/ui/button";
import { appointmentProviderName, getBookByServiceSpecialtyNames } from "@/lib/appointment-provider";

const PILL_TAB_LIST = "!h-auto w-full flex-wrap justify-start gap-2 bg-transparent p-0";
const PILL_TAB_TRIGGER =
  "!h-auto flex-none grow-0 rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-foreground shadow-none data-active:border-transparent data-active:bg-primary data-active:text-primary-foreground";

const INVOICE_DUE_DAYS = 30;

function formatKyat(value: number) {
  return `K ${Math.round(value).toLocaleString()}`;
}

export default async function PortalInvoicesPage() {
  const session = await auth();
  const t = await getTranslations();
  const tp = await getTranslations("portal.invoicesPage");
  const patientId = session?.user.patientId;

  const [invoices, settings, bookByServiceNames] = await Promise.all([
    patientId
      ? prisma.invoice.findMany({
          where: { patientId },
          orderBy: { createdAt: "desc" },
          include: {
            items: true,
            payments: { include: { refunds: true } },
            appointment: {
              include: {
                doctor: { include: { user: true } },
                clinicService: { select: { name: true } },
              },
            },
          },
        })
      : [],
    getClinicSettings(),
    getBookByServiceSpecialtyNames(),
  ]);

  const records: InvoiceRecord[] = invoices.map((invoice) => {
    const paidAmount = invoice.payments.reduce((sum, p) => {
      const refunded = p.refunds.reduce((s, r) => s + Number(r.amount), 0);
      return sum + Number(p.amount) - refunded;
    }, 0);
    const total = Number(invoice.total);
    const dueDate = new Date(invoice.createdAt.getTime() + INVOICE_DUE_DAYS * 86400000);

    return {
      id: invoice.id,
      title: invoice.appointment?.doctor
        ? tp("consultationTitle", {
            specialty: invoice.appointment.doctor.specialty ?? tp("generalFallback"),
          })
        : (invoice.items[0]?.description ?? tp("invoiceFallback")),
      doctorName: invoice.appointment
        ? appointmentProviderName(invoice.appointment, bookByServiceNames)
        : null,
      date: invoice.createdAt,
      dueDate: invoice.status === "PAID" ? null : dueDate,
      total,
      remaining: Math.max(0, total - paidAmount),
      status: invoice.status,
      items: invoice.items.map((item) => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
      })),
    };
  });

  const unpaid = records.filter((r) => r.status !== "PAID");
  const paid = records.filter((r) => r.status === "PAID");
  const outstandingTotal = unpaid.reduce((sum, r) => sum + r.remaining, 0);

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{t("nav.billsPayments")}</h1>
        <p className="text-sm text-muted-foreground">{tp("description")}</p>
      </div>

      {unpaid.length > 0 && (
        <Card className="border-none bg-gradient-to-br from-orange-100 to-amber-100 shadow-none">
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold tracking-wide text-orange-700 uppercase">
                {tp("outstandingBalance")}
              </p>
              <p className="text-3xl font-bold text-orange-700">{formatKyat(outstandingTotal)}</p>
              <p className="text-sm text-orange-700/80">
                {tp("invoicesPending", { count: unpaid.length })}
              </p>
            </div>
            <PayNowDialog
              amount={outstandingTotal}
              phones={settings.phones}
              address={settings.address}
              trigger={
                <Button className="bg-orange-600 text-white hover:bg-orange-700">
                  {tp("payAllNow")}
                </Button>
              }
            />
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="unpaid">
        <TabsList className={PILL_TAB_LIST}>
          <TabsTrigger value="unpaid" className={PILL_TAB_TRIGGER}>
            {tp("tabUnpaid", { count: unpaid.length })}
          </TabsTrigger>
          <TabsTrigger value="paid" className={PILL_TAB_TRIGGER}>
            {tp("tabPaid", { count: paid.length })}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="unpaid" className="mt-4">
          <InvoiceAccordion
            invoices={unpaid}
            emptyMessage={tp("noUnpaid")}
            clinicPhones={settings.phones}
            clinicAddress={settings.address}
          />
        </TabsContent>
        <TabsContent value="paid" className="mt-4">
          <InvoiceAccordion
            invoices={paid}
            emptyMessage={tp("noPaid")}
            clinicPhones={settings.phones}
            clinicAddress={settings.address}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

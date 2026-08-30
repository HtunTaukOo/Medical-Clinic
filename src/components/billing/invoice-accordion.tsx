"use client";

import { useState } from "react";
import { Receipt, CheckCircle2, Download } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { PayNowDialog } from "@/components/billing/pay-now-dialog";

export type InvoiceRecord = {
  id: string;
  title: string;
  doctorName: string | null;
  date: Date;
  dueDate: Date | null;
  total: number;
  remaining: number;
  status: "UNPAID" | "PARTIAL" | "PAID";
  items: { id: string; description: string; quantity: number; unitPrice: number }[];
};

function formatKyat(value: number) {
  return `K ${Math.round(value).toLocaleString()}`;
}

export function InvoiceAccordion({
  invoices,
  emptyMessage,
  clinicPhones,
  clinicAddress,
}: {
  invoices: InvoiceRecord[];
  emptyMessage: string;
  clinicPhones: string[];
  clinicAddress: string | null;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (invoices.length === 0) {
    return <EmptyState icon={Receipt} message={emptyMessage} />;
  }

  return (
    <div className="grid gap-3">
      {invoices.map((invoice) => {
        const expanded = expandedId === invoice.id;
        const isPaid = invoice.status === "PAID";

        return (
          <div key={invoice.id} className="overflow-hidden rounded-lg border bg-white">
            <button
              type="button"
              onClick={() => setExpandedId(expanded ? null : invoice.id)}
              className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-muted/50"
            >
              <div
                className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
                  isPaid ? "bg-emerald-100 text-emerald-600" : "bg-orange-50 text-orange-600"
                }`}
              >
                {isPaid ? <CheckCircle2 className="size-5" /> : <Receipt className="size-4" />}
              </div>
              <div className="flex-1">
                <p className="font-medium">{invoice.title}</p>
                <p className="text-sm text-muted-foreground">
                  {invoice.doctorName ? `${invoice.doctorName} · ` : ""}
                  {invoice.date.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
                {!isPaid && invoice.dueDate && (
                  <p className="text-sm text-orange-600">
                    Due: {invoice.dueDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="font-semibold text-orange-600">{formatKyat(invoice.total)}</p>
                <Badge variant={isPaid ? "success" : "outline"}>
                  {invoice.status === "PARTIAL" ? "Partial" : isPaid ? "Paid" : "Unpaid"}
                </Badge>
              </div>
            </button>

            {expanded && (
              <div className="grid gap-3 border-t p-3">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Invoice items
                </p>
                <div className="grid gap-1.5 text-sm">
                  {invoice.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between">
                      <span>
                        {item.description}
                        {item.quantity > 1 ? ` × ${item.quantity}` : ""}
                      </span>
                      <span>{formatKyat(item.quantity * item.unitPrice)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between border-t pt-2 font-semibold">
                  <span>Total</span>
                  <span>{formatKyat(invoice.total)}</span>
                </div>
                {isPaid ? (
                  <Button asChild variant="outline" className="w-full">
                    <Link href={`/receipt/${invoice.id}`} target="_blank">
                      <Download className="size-4" />
                      Download Receipt
                    </Link>
                  </Button>
                ) : (
                  <PayNowDialog
                    amount={invoice.remaining}
                    phones={clinicPhones}
                    address={clinicAddress}
                    trigger={<Button className="w-full">Pay Now</Button>}
                  />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

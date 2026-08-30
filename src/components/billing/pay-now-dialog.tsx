"use client";

import { Banknote, CreditCard, Smartphone, Phone, MapPin } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

function formatKyat(value: number) {
  return `K ${Math.round(value).toLocaleString()}`;
}

export function PayNowDialog({
  amount,
  phones,
  address,
  trigger,
}: {
  amount: number;
  phones: string[];
  address: string | null;
  trigger: React.ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pay {formatKyat(amount)}</DialogTitle>
          <DialogDescription>
            Online payment isn&apos;t available yet — here&apos;s how to settle this at the clinic.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 text-sm">
          <div className="grid gap-2 rounded-lg border p-3">
            <p className="font-medium">Accepted payment methods</p>
            <div className="grid gap-1.5 text-muted-foreground">
              <span className="flex items-center gap-2">
                <Banknote className="size-4" /> Cash at reception
              </span>
              <span className="flex items-center gap-2">
                <CreditCard className="size-4" /> Card
              </span>
              <span className="flex items-center gap-2">
                <Smartphone className="size-4" /> Mobile banking
              </span>
            </div>
          </div>
          {(phones.length > 0 || address) && (
            <div className="grid gap-2 rounded-lg border p-3">
              <p className="font-medium">Contact the clinic to arrange payment</p>
              <div className="grid gap-1.5 text-muted-foreground">
                {phones.map((phone) => (
                  <span key={phone} className="flex items-center gap-2">
                    <Phone className="size-4" /> {phone}
                  </span>
                ))}
                {address && (
                  <span className="flex items-center gap-2">
                    <MapPin className="size-4" /> {address}
                  </span>
                )}
              </div>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            A staff member will record your payment once received, and this invoice will update automatically.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

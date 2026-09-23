"use client";

import { Banknote, CreditCard, Smartphone, Phone, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

function formatKyat(value: number) {
  return `MMK ${Math.round(value).toLocaleString()}`;
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
  const t = useTranslations("portal.billingCard");
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("payTitle", { amount: formatKyat(amount) })}</DialogTitle>
          <DialogDescription>{t("payDescription")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 text-sm">
          <div className="grid gap-2 rounded-lg border p-3">
            <p className="font-medium">{t("acceptedMethods")}</p>
            <div className="grid gap-1.5 text-muted-foreground">
              <span className="flex items-center gap-2">
                <Banknote className="size-4" /> {t("methodCash")}
              </span>
              <span className="flex items-center gap-2">
                <CreditCard className="size-4" /> {t("methodCard")}
              </span>
              <span className="flex items-center gap-2">
                <Smartphone className="size-4" /> {t("methodMobileBanking")}
              </span>
            </div>
          </div>
          {(phones.length > 0 || address) && (
            <div className="grid gap-2 rounded-lg border p-3">
              <p className="font-medium">{t("contactClinic")}</p>
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
          <p className="text-xs text-muted-foreground">{t("staffWillRecord")}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

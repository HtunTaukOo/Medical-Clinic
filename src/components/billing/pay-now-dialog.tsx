"use client";

import Image from "next/image";
import { Banknote, Smartphone } from "lucide-react";
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
  trigger,
}: {
  amount: number;
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
                <Smartphone className="size-4" /> {t("methodMobileBanking")}
              </span>
            </div>
          </div>
          <div className="grid justify-items-center gap-2 rounded-lg border p-3 text-center">
            <p className="font-medium">{t("scanToPay")}</p>
            <Image
              src="/billing/myanmar-pay-qr.png"
              alt="MyanmarPay MMQR code"
              width={240}
              height={240}
              className="rounded-md"
            />
          </div>
          <p className="text-xs text-muted-foreground">{t("staffWillRecord")}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

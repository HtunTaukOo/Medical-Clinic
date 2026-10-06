"use client";

import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

export function PrintButton() {
  const t = useTranslations("labReport");
  return <Button onClick={() => window.print()}>{t("print")}</Button>;
}

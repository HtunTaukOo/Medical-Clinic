"use client";

import { ChevronLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

// Real browser-history "back" — returns to the literal page the user came
// from (whatever tab/filter/scroll state it had), not a fixed parent route.
// Falls back to `href` only when there's no in-app history to go back to
// (a fresh tab, a bookmark, a direct link from outside the app).
export function BackLink({ href, label }: { href: string; label?: string }) {
  const t = useTranslations("nav");
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        // document.referrer is frozen at whatever it was when this document
        // first loaded — client-side route changes never update it — so it
        // can't tell us whether the user has since navigated within the app.
        // history.length is the only signal that actually reflects that; it
        // only fails to detect a truly fresh tab opened straight to this URL,
        // which is a rare, low-stakes case (worst case: the button no-ops).
        if (typeof window !== "undefined" && window.history.length > 1) {
          router.back();
        } else {
          router.push(href);
        }
      }}
      className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ChevronLeft className="size-4" />
      {label ?? t("back")}
    </button>
  );
}

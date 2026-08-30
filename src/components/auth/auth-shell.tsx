import type { ReactNode } from "react";
import { ShieldCheck, CalendarCheck, Stethoscope } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ClinicLogo } from "@/components/clinic-logo";

const FEATURE_ICONS = [ShieldCheck, CalendarCheck, Stethoscope] as const;

export async function AuthShell({ children }: { children: ReactNode }) {
  const t = await getTranslations("app");
  const tAuth = await getTranslations("auth");
  const features = [
    tAuth("featureRecords"),
    tAuth("featureAppointments"),
    tAuth("featureCare"),
  ];

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden p-4 sm:p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/4 size-96 rounded-full bg-primary/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 right-1/4 size-96 rounded-full bg-primary/15 blur-3xl"
      />
      <div className="relative grid w-full max-w-4xl overflow-hidden rounded-3xl shadow-[0_1px_2px_rgba(0,0,0,0.04),0_32px_64px_-24px_rgba(0,0,0,0.18)] ring-1 ring-foreground/[0.06] backdrop-blur-xl md:grid-cols-2">
        <div className="relative hidden flex-col justify-between gap-10 overflow-hidden bg-gradient-to-br from-primary via-primary to-blue-900/90 p-10 text-primary-foreground md:flex">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-white/10 blur-2xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-28 -left-16 size-64 rounded-full bg-black/10 blur-2xl"
          />
          <div className="relative flex items-center gap-2.5">
            <ClinicLogo className="size-12 shrink-0 rounded-lg" />
            <span className="text-lg font-semibold">{t("shortName")}</span>
          </div>
          <div className="relative grid gap-6">
            <h2 className="text-2xl leading-snug font-semibold text-balance">
              {t("name")}
            </h2>
            <ul className="grid gap-3 text-sm text-primary-foreground/90">
              {features.map((feature, i) => {
                const Icon = FEATURE_ICONS[i];
                return (
                  <li key={feature} className="flex items-center gap-2.5">
                    <Icon className="size-4 shrink-0" />
                    <span>{feature}</span>
                  </li>
                );
              })}
            </ul>
          </div>
          <p className="relative text-xs text-primary-foreground/70">
            {tAuth("tagline")}
          </p>
        </div>
        <div className="flex flex-col justify-center bg-card/80 p-8 backdrop-blur-2xl sm:p-10">
          {children}
        </div>
      </div>
    </div>
  );
}

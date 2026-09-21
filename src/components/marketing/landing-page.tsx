import Image from "next/image";
import { getTranslations } from "next-intl/server";
import {
  CalendarDays,
  FlaskConical,
  FileText,
  Pill,
  UserPlus,
  Clock,
  ShieldCheck,
  Users,
  ArrowRight,
  MapPin,
  Phone,
  Mail,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ClinicLogo } from "@/components/clinic-logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import {
  getClinicSettings,
  getClinicHoursForDate,
  formatTime,
  isWithinOpeningHours,
} from "@/lib/clinic-hours";

const FEATURE_ICONS = [CalendarDays, FlaskConical, FileText, Pill, UserPlus, Clock] as const;
const JOURNEY_ICONS = [CalendarDays, FileText, FlaskConical, FileText, Pill] as const;
const TRUST_ICONS = [ShieldCheck, ShieldCheck, Clock] as const;

// The public marketing home page shown to signed-out visitors at "/" (see
// src/app/[locale]/page.tsx) — signed-in users still redirect straight to
// their dashboard, unchanged. Built from a design mockup; the mockup's
// illustrative laptop/phone dashboard mockup was replaced with real
// screenshots of the actual booking page and portal home screen (see
// public/marketing/), and the logo comes from the same ClinicLogo/
// getClinicSettings pair every other page already uses instead of a
// hardcoded one.
export async function LandingPage() {
  const t = await getTranslations("landing");
  const tApp = await getTranslations("app");
  const tClinic = await getTranslations("clinic");
  const settings = await getClinicSettings();
  const hasLogo = !!settings.logoData;
  const year = new Date().getFullYear();
  const now = new Date();
  const todayHours = await getClinicHoursForDate(now);
  const openNow = todayHours.isOpen && isWithinOpeningHours(now, todayHours.openTime, todayHours.closeTime);
  const mapsUrl = settings.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(settings.address)}`
    : null;
  const hasContactInfo = !!settings.address || settings.phones.length > 0 || !!settings.email;

  const features = [
    { titleKey: "appointmentBookingTitle", descKey: "appointmentBookingDesc" },
    { titleKey: "labTestsTitle", descKey: "labTestsDesc" },
    { titleKey: "testResultsTitle", descKey: "testResultsDesc" },
    { titleKey: "treatmentRecordsTitle", descKey: "treatmentRecordsDesc" },
    { titleKey: "walkInTitle", descKey: "walkInDesc" },
    { titleKey: "scheduleTitle", descKey: "scheduleDesc" },
  ] as const;

  const journeySteps = ["step1", "step2", "step3", "step4", "step5"] as const;
  const trustItems = ["convenientServices", "secureInformation", "timeSaving"] as const;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <ClinicLogo hasLogo={hasLogo} className="size-10 shrink-0 rounded-lg" />
            <div className="leading-tight">
              <p className="font-semibold">{tApp("shortName")}</p>
              <p className="text-xs text-muted-foreground">{tApp("name")}</p>
            </div>
          </div>
          <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
            <a href="#home" className="text-foreground">
              {t("nav.home")}
            </a>
            <a href="#features" className="hover:text-foreground">
              {t("nav.services")}
            </a>
            <a href="#digital" className="hover:text-foreground">
              {t("nav.aboutUs")}
            </a>
            <a href="#contact" className="hover:text-foreground">
              {t("nav.contact")}
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <LocaleSwitcher />
            <Button asChild variant="outline" size="sm">
              <Link href="/login">{t("nav.login")}</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/register">{t("nav.signUp")}</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section id="home" className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -right-24 size-96 rounded-full bg-primary/15 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute top-40 -left-24 size-80 rounded-full bg-primary/10 blur-3xl"
        />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-2 lg:items-center">
          <div className="grid gap-6">
            <h1 className="text-4xl leading-[1.3] font-bold tracking-tight text-balance sm:text-5xl">
              <span className="block text-primary">{t("hero.titleLine1")}</span>
              <span className="block">{t("hero.titleLine2")}</span>
            </h1>
            <p className="max-w-lg text-lg text-muted-foreground">{t("hero.description")}</p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/register">
                  {t("hero.bookAppointment")}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/register">{t("hero.signUp")}</Link>
              </Button>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 pt-2 text-sm text-muted-foreground">
              {[t("hero.secureReliable"), t("hero.easyToUse"), t("hero.saveTime")].map((label, i) => {
                const Icon = TRUST_ICONS[i];
                return (
                  <span key={label} className="flex items-center gap-2">
                    <Icon className="size-4 text-primary" />
                    {label}
                  </span>
                );
              })}
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-xl">
            {/* No card/border here on purpose — a soft alpha mask fades the
                photo's own edges into the section background instead of
                clipping it behind a hard rectangle, so it reads as blended
                into the page rather than a boxed-in image. Faded most
                toward the bottom-right (where the caption sits), matching
                the source photo's own light fade in that corner; natural
                aspect ratio (not force-cropped) so that fade lines up. */}
            <div
              className="relative aspect-[757/537]"
              style={{
                maskImage: "radial-gradient(140% 140% at 25% 20%, black 50%, transparent 95%)",
                WebkitMaskImage: "radial-gradient(140% 140% at 25% 20%, black 50%, transparent 95%)",
              }}
            >
              <Image
                src="/marketing/landing-hero-photo.png"
                alt={t("hero.photoAlt")}
                fill
                className="object-cover"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => {
            const Icon = FEATURE_ICONS[i];
            return (
              <div key={feature.titleKey} className="grid gap-3 rounded-2xl border bg-card p-6 shadow-sm">
                <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon className="size-6" />
                </div>
                <h3 className="font-semibold">{t(`features.${feature.titleKey}`)}</h3>
                <p className="text-sm text-muted-foreground">{t(`features.${feature.descKey}`)}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Digital technology / real screenshots */}
      <section id="digital" className="bg-muted/40 py-16">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:items-center">
          <div className="grid gap-5">
            <h2 className="text-3xl leading-[1.3] font-bold tracking-tight sm:text-4xl">
              <span className="block">{t("digital.titleNormal")}</span>
              <span className="block text-primary">{t("digital.titleHighlight")}</span>
            </h2>
            <p className="max-w-lg text-muted-foreground">{t("digital.description")}</p>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              {trustItems.map((key, i) => {
                const Icon = [ShieldCheck, ShieldCheck, Clock][i];
                return (
                  <span key={key} className="flex items-center gap-2">
                    <Icon className="size-4 text-primary" />
                    {t(`digital.${key}`)}
                  </span>
                );
              })}
            </div>
          </div>
          {/* A laptop + phone device-frame pair (pure CSS, no mockup image
              assets — robust and no broken-image risk), each showing a real
              screenshot cropped to the device's characteristic screen
              shape via object-cover. Phone overlaps the laptop's bottom
              corner, same layered composition as the original design. */}
          <div className="relative mx-auto w-full max-w-md pb-10 sm:pb-14 lg:mx-0">
            <div>
              <div className="rounded-t-xl border-[6px] border-b-0 border-neutral-800 bg-neutral-800">
                <div className="relative aspect-[16/10] overflow-hidden rounded-xs bg-white">
                  <Image
                    src="/marketing/landing-book-appointment.png"
                    alt={t("digital.screenshotBookAlt")}
                    fill
                    className="object-cover object-top"
                  />
                </div>
              </div>
              <div className="h-2.5 rounded-b-lg bg-gradient-to-b from-neutral-700 to-neutral-600" />
              <div className="mx-auto h-1 w-1/5 rounded-b bg-neutral-500" />
            </div>
            <div className="absolute -right-2 -bottom-2 w-28 sm:-right-6 sm:-bottom-4 sm:w-36">
              <div className="rounded-[1.6rem] border-[6px] border-neutral-800 bg-neutral-800 shadow-xl">
                <div className="relative aspect-[9/19] overflow-hidden rounded-[1.1rem] bg-white">
                  <Image
                    src="/marketing/landing-portal-home.jpg"
                    alt={t("digital.screenshotPortalAlt")}
                    fill
                    className="object-cover object-top"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Journey */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="mb-10 text-center text-3xl leading-[1.3] font-bold tracking-tight">{t("journey.title")}</h2>
        <div className="grid gap-4 sm:grid-cols-5 sm:items-start">
          {journeySteps.map((stepKey, i) => {
            const Icon = JOURNEY_ICONS[i];
            return (
              <div key={stepKey} className="flex items-center gap-2 sm:flex-col sm:text-center">
                <div className="grid gap-2 sm:justify-items-center">
                  <div className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon className="size-6" />
                  </div>
                  <p className="text-sm font-semibold text-muted-foreground">
                    0{i + 1} · {t(`journey.${stepKey}`)}
                  </p>
                </div>
                {i < journeySteps.length - 1 && (
                  <ArrowRight className="hidden size-5 shrink-0 text-muted-foreground/40 sm:mt-6 sm:block" />
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-primary px-6 py-12 text-center text-primary-foreground sm:px-12">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-16 -right-16 size-64 rounded-full bg-white/10 blur-2xl"
          />
          <h2 className="text-2xl leading-[1.3] font-bold sm:text-3xl">{t("cta.title")}</h2>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" variant="secondary">
              <Link href="/register">{t("cta.signUp")}</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-white/10 hover:text-primary-foreground"
            >
              <Link href="/login">{t("cta.login")}</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Contact — bg-muted/40 + blur decorations match the Hero/Digital
          sections' treatment, so this reads as part of the same design
          system rather than a bare add-on. flex+justify-center (not a rigid
          3-col grid) so 1-3 cards always stay centered instead of leaving a
          lopsided empty column when e.g. no email is configured. */}
      <section id="contact" className="relative overflow-hidden bg-muted/40 py-16">
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -left-24 size-80 rounded-full bg-primary/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-20 -right-20 size-72 rounded-full bg-primary/10 blur-3xl"
        />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-10 grid justify-items-center gap-3 text-center">
            <h2 className="text-3xl leading-[1.3] font-bold tracking-tight">{t("contact.title")}</h2>
            {todayHours.isOpen && (
              <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
                <Badge
                  className={
                    openNow
                      ? "gap-1.5 border-emerald-200 bg-emerald-100 text-emerald-700"
                      : "gap-1.5 border-rose-200 bg-rose-100 text-rose-700"
                  }
                >
                  <span className={`size-1.5 rounded-full ${openNow ? "bg-emerald-500" : "bg-rose-500"}`} />
                  {openNow ? tClinic("statusOpenNow") : tClinic("statusClosedNow")}
                </Badge>
                <span>
                  {tClinic("hoursToday", {
                    opening: formatTime(todayHours.openTime),
                    closing: formatTime(todayHours.closeTime),
                  })}
                </span>
              </div>
            )}
          </div>

          {hasContactInfo ? (
            <div className="flex flex-wrap justify-center gap-4">
              {settings.address && (
                <div className="grid w-72 justify-items-center gap-2 rounded-2xl border bg-card p-6 text-center shadow-sm transition-shadow hover:shadow-md">
                  <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <MapPin className="size-6" />
                  </div>
                  <p className="font-semibold">{t("contact.addressTitle")}</p>
                  <p className="text-sm text-muted-foreground">{settings.address}</p>
                  {mapsUrl && (
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-primary underline underline-offset-2"
                    >
                      {t("contact.getDirections")}
                    </a>
                  )}
                </div>
              )}
              {settings.phones.length > 0 && (
                <div className="grid w-72 justify-items-center gap-2 rounded-2xl border bg-card p-6 text-center shadow-sm transition-shadow hover:shadow-md">
                  <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Phone className="size-6" />
                  </div>
                  <p className="font-semibold">{t("contact.phoneTitle")}</p>
                  <div className="grid gap-1 text-sm text-muted-foreground">
                    {settings.phones.map((phone) => (
                      <a key={phone} href={`tel:${phone}`} className="hover:text-foreground">
                        {phone}
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {settings.email && (
                <div className="grid w-72 justify-items-center gap-2 rounded-2xl border bg-card p-6 text-center shadow-sm transition-shadow hover:shadow-md">
                  <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Mail className="size-6" />
                  </div>
                  <p className="font-semibold">{t("contact.emailTitle")}</p>
                  <a
                    href={`mailto:${settings.email}`}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    {settings.email}
                  </a>
                </div>
              )}
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground">{t("contact.noContactYet")}</p>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer id="footer" className="border-t bg-card">
        <div className="mx-auto grid max-w-6xl gap-4 px-4 py-8 sm:flex sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-2.5">
            <ClinicLogo hasLogo={hasLogo} className="size-9 shrink-0 rounded-lg" />
            <div className="leading-tight">
              <p className="font-semibold">{tApp("shortName")}</p>
              <p className="text-xs text-muted-foreground">{tApp("name")}</p>
            </div>
          </div>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="size-4" />
            {t("footer.tagline")}
          </p>
        </div>
        <div className="border-t px-4 py-4 text-center text-xs text-muted-foreground sm:px-6">
          {t("footer.copyright", { year })}
        </div>
      </footer>
    </div>
  );
}

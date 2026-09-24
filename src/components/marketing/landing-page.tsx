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
  ArrowRight,
  Phone,
  Mail,
  Heart,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ClinicLogo } from "@/components/clinic-logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { OrbitIconRing } from "@/components/marketing/orbit-icon-ring";
import { HeroPhotoCollage } from "@/components/marketing/hero-photo-collage";
import { getClinicSettings, getClinicHoursForDate, formatTime } from "@/lib/clinic-hours";

const FEATURE_ICONS = [CalendarDays, FlaskConical, FileText, Pill, UserPlus, Clock] as const;
const TRUST_ICONS = [ShieldCheck, ShieldCheck, Clock] as const;

// The public marketing home page shown to signed-out visitors at "/" (see
// src/app/[locale]/page.tsx) — signed-in users still redirect straight to
// their dashboard, unchanged. Rebuilt to match a design mockup (header nav →
// hero → orbit/digital section → services grid → CTA banner → location/map
// → contacts banner → footer); the logo comes from the same ClinicLogo/
// getClinicSettings pair every other page already uses instead of a
// hardcoded one, and address/phone/hours are the real admin-configured
// clinic settings rather than copy hardcoded from the mockup.
export async function LandingPage() {
  const t = await getTranslations("landing");
  const tApp = await getTranslations("app");
  const settings = await getClinicSettings();
  const hasLogo = !!settings.logoData;
  const year = new Date().getFullYear();
  const now = new Date();
  const todayHours = await getClinicHoursForDate(now);
  const mapsUrl = settings.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(settings.address)}`
    : null;
  const hasReachInfo = settings.phones.length > 0 || !!settings.email;

  const features = [
    { titleKey: "appointmentBookingTitle", descKey: "appointmentBookingDesc" },
    { titleKey: "labTestsTitle", descKey: "labTestsDesc" },
    { titleKey: "testResultsTitle", descKey: "testResultsDesc" },
    { titleKey: "treatmentRecordsTitle", descKey: "treatmentRecordsDesc" },
    { titleKey: "walkInTitle", descKey: "walkInDesc" },
    { titleKey: "scheduleTitle", descKey: "scheduleDesc" },
  ] as const;

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
            <a href="#digital" className="hover:text-foreground">
              {t("nav.aboutUs")}
            </a>
            <a href="#services" className="hover:text-foreground">
              {t("nav.services")}
            </a>
            <a href="#location" className="hover:text-foreground">
              {t("nav.location")}
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
          <HeroPhotoCollage
            altTexts={[
              t("hero.photoAlt1"),
              t("hero.photoAlt2"),
              t("hero.photoAlt3"),
              t("hero.photoAlt4"),
            ]}
          />
        </div>
      </section>

      {/* Digital technology — orbit-icon ring + real screenshots */}
      <section id="digital" className="bg-muted/40 py-16">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:items-center">
          <div className="flex justify-center">
            <OrbitIconRing hasLogo={hasLogo} label={tApp("shortName")} />
          </div>

          <div className="grid gap-8">
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
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="mb-10 grid justify-items-center gap-2 text-center">
          <p className="text-sm font-semibold tracking-wide text-primary uppercase">{t("features.eyebrow")}</p>
          <h2 className="text-3xl leading-[1.3] font-bold tracking-tight sm:text-4xl">{t("features.heading")}</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => {
            const Icon = FEATURE_ICONS[i];
            return (
              <div
                key={feature.titleKey}
                className="grid gap-3 rounded-2xl border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex size-12 items-center justify-center rounded-full bg-teal-50 text-teal-600">
                  <Icon className="size-6" />
                </div>
                <h3 className="font-semibold">{t(`features.${feature.titleKey}`)}</h3>
                <p className="text-sm text-muted-foreground">{t(`features.${feature.descKey}`)}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-mid to-primary px-6 py-12 text-primary-foreground sm:px-12">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-16 -right-16 size-64 rounded-full bg-white/10 blur-2xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-20 left-1/3 size-56 rounded-full bg-white/5 blur-3xl"
          />
          <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="grid gap-4 text-center lg:text-left">
              <h2 className="text-2xl leading-[1.3] font-bold sm:text-3xl">{t("cta.title")}</h2>
              <p className="mx-auto max-w-md text-primary-foreground/80 lg:mx-0">{t("cta.description")}</p>
              <div className="flex flex-wrap justify-center gap-3 lg:justify-start">
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-white/10 hover:text-primary-foreground"
                >
                  <Link href="/register">{t("cta.signUp")}</Link>
                </Button>
              </div>
            </div>
            <div className="relative mx-auto hidden size-40 shrink-0 overflow-hidden rounded-full ring-4 ring-white/20 sm:block">
              <Image src="/marketing/landing-hero-photo.png" alt="" aria-hidden fill className="object-cover" />
            </div>
          </div>
        </div>
      </section>

      {/* Location */}
      <section id="location" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <p className="mb-8 text-center text-sm font-semibold tracking-wide text-primary uppercase">
          {t("location.eyebrow")}
        </p>
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div className="grid gap-4">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {t("location.findLabel")}
            </p>
            <h2 className="text-3xl leading-[1.3] font-bold tracking-tight sm:text-4xl">{t("location.heading")}</h2>
            {settings.address ? (
              <>
                <p className="max-w-md text-muted-foreground">
                  {t("location.description", { address: settings.address })}
                </p>
                {mapsUrl && (
                  <Button asChild size="lg" className="w-fit">
                    <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
                      {t("contact.getDirections")}
                      <ArrowRight className="size-4" />
                    </a>
                  </Button>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">{t("contact.noContactYet")}</p>
            )}
          </div>
          {settings.address && (
            <div className="overflow-hidden rounded-3xl border shadow-sm">
              <iframe
                title={t("location.mapAlt")}
                src={`https://www.google.com/maps?q=${encodeURIComponent(settings.address)}&output=embed`}
                className="h-80 w-full sm:h-96"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          )}
        </div>
      </section>

      {/* Contacts */}
      <section id="contact" className="relative overflow-hidden bg-muted/40 py-16">
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -left-24 size-80 rounded-full bg-primary/10 blur-3xl"
        />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-8 grid justify-items-center gap-3 text-center">
            <p className="text-sm font-semibold tracking-wide text-primary uppercase">{t("contact.eyebrow")}</p>
          </div>

          {hasReachInfo ? (
            <div className="flex flex-col items-center justify-center gap-6 rounded-3xl bg-card px-6 py-10 shadow-sm sm:flex-row sm:flex-wrap sm:gap-x-16 sm:px-12">
              {settings.phones.length > 0 && (
                <div className="flex items-center gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Phone className="size-5" />
                  </div>
                  <div className="grid gap-0.5">
                    {settings.phones.map((phone) => (
                      <a key={phone} href={`tel:${phone}`} className="font-medium hover:underline">
                        {phone}
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {settings.email && (
                <div className="flex items-center gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Mail className="size-5" />
                  </div>
                  <a href={`mailto:${settings.email}`} className="font-medium hover:underline">
                    {settings.email}
                  </a>
                </div>
              )}
              {todayHours.isOpen && (
                <div className="flex items-center gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Clock className="size-5" />
                  </div>
                  <p className="font-medium">
                    {t("contact.responseHours", {
                      opening: formatTime(todayHours.openTime),
                      closing: formatTime(todayHours.closeTime),
                    })}
                  </p>
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
            <Heart className="size-4 text-primary" />
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

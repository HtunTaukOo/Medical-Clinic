import { NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { auth } from "@/auth";
import { routing } from "@/i18n/routing";

const intlMiddleware = createMiddleware(routing);
const LOCALE_PATTERN = new RegExp(`^/(${routing.locales.join("|")})(?=/|$)`);

function stripLocale(pathname: string) {
  const match = pathname.match(LOCALE_PATTERN);
  if (!match) return { locale: routing.defaultLocale, rest: pathname };
  const rest = pathname.slice(match[0].length) || "/";
  return { locale: match[1], rest };
}

export const proxy = auth((req) => {
  const { nextUrl } = req;
  const { locale, rest } = stripLocale(nextUrl.pathname);
  const session = req.auth;

  const isStaffRoute = rest.startsWith("/staff");
  const isPortalRoute = rest.startsWith("/portal");
  const isDoctorRoute = rest.startsWith("/doctor");

  if (isStaffRoute || isPortalRoute || isDoctorRoute) {
    if (!session?.user) {
      const loginUrl = new URL(`/${locale}/login`, nextUrl);
      loginUrl.searchParams.set("callbackUrl", nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }

    const role = session.user.role;
    const home = role === "PATIENT" ? "/portal" : role === "DOCTOR" ? "/doctor" : "/staff";

    if (isStaffRoute && role !== "ADMIN" && role !== "STAFF") {
      return NextResponse.redirect(new URL(`/${locale}${home}`, nextUrl));
    }
    if (isPortalRoute && role !== "PATIENT") {
      return NextResponse.redirect(new URL(`/${locale}${home}`, nextUrl));
    }
    if (isDoctorRoute && role !== "DOCTOR") {
      return NextResponse.redirect(new URL(`/${locale}${home}`, nextUrl));
    }
    if (rest.startsWith("/staff/users") && role !== "ADMIN") {
      return NextResponse.redirect(new URL(`/${locale}/staff`, nextUrl));
    }
  }

  return intlMiddleware(req);
});

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};

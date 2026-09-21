import { auth } from "@/auth";
import { redirect } from "@/i18n/navigation";
import { LandingPage } from "@/components/marketing/landing-page";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();

  if (!session?.user) {
    return <LandingPage />;
  } else if (session.user.role === "PATIENT") {
    redirect({ href: "/portal", locale });
  } else if (session.user.role === "DOCTOR") {
    redirect({ href: "/doctor", locale });
  } else {
    redirect({ href: "/staff", locale });
  }
}

import { auth } from "@/auth";
import { redirect } from "@/i18n/navigation";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();

  if (!session?.user) {
    redirect({ href: "/login", locale });
  } else if (session.user.role === "PATIENT") {
    redirect({ href: "/portal", locale });
  } else {
    redirect({ href: "/staff", locale });
  }
}

import { AuthError } from "next-auth";
import { getTranslations } from "next-intl/server";
import { signIn } from "@/auth";
import { redirect } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const { locale } = await params;
  const { callbackUrl, error } = await searchParams;
  const t = await getTranslations("auth");

  async function loginAction(formData: FormData) {
    "use server";
    try {
      await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirectTo: callbackUrl || `/${locale}`,
      });
    } catch (err) {
      if (err instanceof AuthError) {
        redirect({
          href: `/login?error=CredentialsSignin${callbackUrl ? `&callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`,
          locale,
        });
      }
      throw err;
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{t("loginTitle")}</CardTitle>
          {error && (
            <CardDescription className="text-destructive">
              {t("invalidCredentials")}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <form action={loginAction} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">{t("email")}</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">{t("password")}</Label>
              <Input id="password" name="password" type="password" required />
            </div>
            <Button type="submit" className="w-full">
              {t("login")}
            </Button>
          </form>
          <p className="mt-4 text-sm text-muted-foreground">
            {t("noAccount")}{" "}
            <Link href="/register" className="underline">
              {t("register")}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

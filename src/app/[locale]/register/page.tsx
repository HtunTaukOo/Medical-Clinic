import { getTranslations } from "next-intl/server";
import { RegisterForm } from "@/components/auth/register-form";
import { AuthShell } from "@/components/auth/auth-shell";

export default async function RegisterPage() {
  const t = await getTranslations("auth");

  return (
    <AuthShell>
      <h1 className="text-xl font-semibold">{t("registerTitle")}</h1>
      <div className="mt-6">
        <RegisterForm />
      </div>
    </AuthShell>
  );
}

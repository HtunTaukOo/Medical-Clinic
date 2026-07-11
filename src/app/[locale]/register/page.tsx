import { getTranslations } from "next-intl/server";
import { RegisterForm } from "@/components/auth/register-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function RegisterPage() {
  const t = await getTranslations("auth");

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{t("registerTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <RegisterForm />
        </CardContent>
      </Card>
    </div>
  );
}

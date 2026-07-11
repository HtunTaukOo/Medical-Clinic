import { getTranslations } from "next-intl/server";
import { signOut } from "@/auth";
import { Button } from "@/components/ui/button";

export async function SignOutButton({ locale }: { locale: string }) {
  const t = await getTranslations("nav");

  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: `/${locale}/login` });
      }}
    >
      <Button type="submit" variant="ghost" size="sm">
        {t("signOut")}
      </Button>
    </form>
  );
}

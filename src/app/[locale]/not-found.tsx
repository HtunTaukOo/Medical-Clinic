import { FileQuestion } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";

// Catches every notFound() in the app — including a notification whose
// linked appointment (or other record) no longer exists — with a friendly
// message instead of the bare, unstyled Next.js default 404.
export default async function NotFound() {
  const t = await getTranslations("notFound");

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="grid w-full max-w-sm gap-3 text-center">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <EmptyState
          icon={FileQuestion}
          message={t("description")}
          action={
            <Button asChild size="sm" className="mt-1">
              <Link href="/">{t("backHome")}</Link>
            </Button>
          }
        />
      </div>
    </div>
  );
}

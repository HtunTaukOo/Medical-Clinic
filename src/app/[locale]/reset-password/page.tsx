import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Set a new password</CardTitle>
          {!token && (
            <CardDescription className="text-destructive">
              This reset link is missing its token. Please use the link from your
              reset message.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>{token && <ResetPasswordForm token={token} />}</CardContent>
      </Card>
    </div>
  );
}

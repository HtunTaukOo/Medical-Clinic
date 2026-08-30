import { UserCog, Mail } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/authz";
import { toggleStaffActive } from "@/actions/staff";
import { initials } from "@/lib/format";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { EmptyState } from "@/components/empty-state";
import { DoctorFeeForm } from "@/components/staff/doctor-fee-form";
import { SetPasswordForm } from "@/components/staff/set-password-form";

export default async function StaffUsersPage() {
  await requirePageRole(["ADMIN"]);
  const t = await getTranslations("staff");

  const staff = await prisma.user.findMany({
    where: { role: { not: "PATIENT" } },
    include: { doctorProfile: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <Button asChild>
          <Link href="/staff/users/new">{t("new")}</Link>
        </Button>
      </div>

      {staff.length === 0 ? (
        <EmptyState icon={UserCog} message={t("noResults")} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {staff.map((user) => (
            <Card key={user.id}>
              <CardContent className="grid gap-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <Avatar className="size-12">
                      <AvatarFallback className="bg-secondary text-secondary-foreground">
                        {initials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{user.name}</p>
                      <Badge variant="outline">{user.role}</Badge>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="size-4" />
                  {user.email}
                </div>
                {user.doctorProfile && (
                  <>
                    <DoctorFeeForm
                      doctorId={user.doctorProfile.id}
                      currentFee={Number(user.doctorProfile.consultationFee)}
                      currentExperienceYears={user.doctorProfile.experienceYears}
                      currentQualifications={user.doctorProfile.qualifications}
                    />
                    <Button asChild size="sm" variant="outline" className="w-fit">
                      <Link href={`/staff/users/${user.doctorProfile.id}/availability`}>
                        Manage availability
                      </Link>
                    </Button>
                  </>
                )}
                <SetPasswordForm userId={user.id} />
                <div className="flex items-center justify-between gap-2">
                  <Badge variant={user.active ? "success" : "outline"}>
                    {user.active ? t("active") : "Inactive"}
                  </Badge>
                  <form action={toggleStaffActive.bind(null, user.id)}>
                    <Button size="sm" variant={user.active ? "destructive" : "secondary"} type="submit">
                      {user.active ? t("deactivate") : t("activate")}
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

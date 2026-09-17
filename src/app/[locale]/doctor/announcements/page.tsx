import { Megaphone } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/authz";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { BackLink } from "@/components/back-link";

export default async function DoctorAnnouncementsPage() {
  await requirePageRole(["DOCTOR"]);

  const announcements = await prisma.announcement.findMany({
    where: { active: true },
    orderBy: { createdAt: "desc" },
    include: { author: true },
  });

  return (
    <div className="grid gap-6">
      <BackLink href="/doctor" />

      <div>
        <h1 className="text-2xl font-semibold">Announcements</h1>
        <p className="text-sm text-muted-foreground">Messages posted to staff and patients.</p>
      </div>

      {announcements.length === 0 ? (
        <EmptyState icon={Megaphone} message="No announcements yet." />
      ) : (
        <div className="grid gap-4">
          {announcements.map((a) => (
            <Card key={a.id}>
              <CardContent className="grid gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{a.category}</Badge>
                  <p className="font-semibold">{a.title}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {a.author.name} · {new Date(a.createdAt).toLocaleDateString()}
                </p>
                <p className="text-sm whitespace-pre-wrap">{a.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

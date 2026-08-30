import { Megaphone } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/authz";
import { toggleAnnouncementActive } from "@/actions/announcements";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { AnnouncementForm } from "@/components/staff/announcement-form";

export default async function AnnouncementsPage() {
  await requirePageRole(["ADMIN", "RECEPTIONIST"]);

  const announcements = await prisma.announcement.findMany({
    orderBy: { createdAt: "desc" },
    include: { author: true },
  });

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">Announcements</h1>

      <Card>
        <CardHeader>
          <CardTitle>New announcement</CardTitle>
        </CardHeader>
        <CardContent>
          <AnnouncementForm />
        </CardContent>
      </Card>

      {announcements.length === 0 ? (
        <EmptyState icon={Megaphone} message="No announcements yet." />
      ) : (
        <div className="grid gap-4">
          {announcements.map((a) => (
            <Card key={a.id}>
              <CardContent className="grid gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{a.category}</Badge>
                      <p className="font-semibold">{a.title}</p>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {a.author.name} · {new Date(a.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant={a.active ? "success" : "outline"}>
                    {a.active ? "Published" : "Hidden"}
                  </Badge>
                </div>
                <p className="text-sm whitespace-pre-wrap">{a.body}</p>
                <form action={toggleAnnouncementActive.bind(null, a.id)}>
                  <Button size="sm" variant="outline" type="submit" className="w-fit">
                    {a.active ? "Hide" : "Publish"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

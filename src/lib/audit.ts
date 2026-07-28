import { prisma } from "@/lib/prisma";

export async function logActivity({
  actorId,
  actorName,
  actorRole,
  action,
  target,
}: {
  actorId: string | null;
  actorName: string;
  actorRole: string;
  action: string;
  target?: string;
}) {
  await prisma.activityLog.create({
    data: { actorId, actorName, actorRole, action, target },
  });
}

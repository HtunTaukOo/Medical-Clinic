import { prisma } from "@/lib/prisma";
import { todayRange } from "@/lib/queue";

export const ESTIMATED_MINUTES_PER_PATIENT = 15;

export async function getNextTokenNumber() {
  const { start, end } = todayRange();
  const count = await prisma.walkIn.count({
    where: { createdAt: { gte: start, lt: end } },
  });
  return count + 1;
}

export function estimateWaitMinutes(position: number) {
  return position * ESTIMATED_MINUTES_PER_PATIENT;
}

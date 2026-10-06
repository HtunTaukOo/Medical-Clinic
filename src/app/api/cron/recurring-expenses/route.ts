import { NextResponse } from "next/server";
import { createDueRecurringExpenses } from "@/lib/recurring-expenses";

// Runs daily rather than monthly so schedules anchored to the 29th–31st can
// be safely clamped to the last available day of shorter months.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const created = await createDueRecurringExpenses();
  return NextResponse.json({ ok: true, created });
}

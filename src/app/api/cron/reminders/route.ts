import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runReminders } from "@/server/reminders";

export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "ไม่ได้รับอนุญาต" }, { status: 401 });
  return NextResponse.json(await runReminders(new Date()));
}

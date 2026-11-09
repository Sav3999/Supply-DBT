import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { unreadCount } from "@/server/notifications";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  return NextResponse.json({ count: await unreadCount(user.id) });
}

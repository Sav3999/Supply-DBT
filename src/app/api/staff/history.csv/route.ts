import { NextResponse } from "next/server";
import { formatDateOnly, todayBangkok } from "@/lib/dates";
import { getCurrentUser } from "@/server/auth/session";
import { historyToCsv, parseHistoryFilter, searchHistory } from "@/server/reports";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (user.role !== "STAFF" && user.role !== "ADMIN") {
    return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  }
  const filter = parseHistoryFilter(new URL(req.url).searchParams);
  const csv = historyToCsv(await searchHistory(filter, 5000));
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="history-${formatDateOnly(todayBangkok())}.csv"`,
    },
  });
}

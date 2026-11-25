import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { todayBangkok } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { requirePageRole } from "@/server/auth/session";
import { dashboardCounts } from "@/server/reports";

export const dynamic = "force-dynamic";

export default async function StaffDashboardPage() {
  await requirePageRole("STAFF");
  const c = await dashboardCounts(todayBangkok());
  const cards = [
    { label: "รออนุมัติ", n: c.pending, href: "/staff/loans?status=PENDING" },
    { label: "รอส่งมอบวันนี้", n: c.toHandOverToday, href: "/staff/loans?status=APPROVED" },
    { label: "ครบกำหนดคืนวันนี้", n: c.dueToday, href: "/staff/loans?status=BORROWED" },
    { label: "เกินกำหนด", n: c.overdue, href: "/staff/loans?status=OVERDUE", warn: true },
  ];
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">แดชบอร์ดเจ้าหน้าที่</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map((x) => (
          <Link key={x.href} href={x.href}>
            <Card className="h-full transition-colors hover:border-primary/40 hover:bg-brand-surface">
              <CardContent className="space-y-2 py-4">
                <p className="text-sm text-muted-foreground">{x.label}</p>
                <p
                  className={cn(
                    "font-heading text-4xl leading-none font-semibold tabular-nums",
                    x.warn && x.n > 0 ? "text-status-overdue" : x.n === 0 ? "text-muted-foreground/60" : "text-foreground",
                  )}
                >
                  {x.n.toLocaleString("th-TH")}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

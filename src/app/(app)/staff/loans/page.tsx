import Link from "next/link";
import type { LoanStatus } from "@prisma/client";
import { LoanStatusBadge } from "@/components/loan-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatThaiDate, todayBangkok } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { requirePageRole } from "@/server/auth/session";
import { listLoansForStaff } from "@/server/loans/staff";
import { isOverdue } from "@/server/loans/status";

const TABS = [
  { key: "PENDING", label: "รออนุมัติ" },
  { key: "APPROVED", label: "รอส่งมอบ" },
  { key: "BORROWED", label: "กำลังยืม" },
  { key: "OVERDUE", label: "เกินกำหนด" },
  { key: "ALL", label: "ทั้งหมด" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default async function StaffLoansPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  await requirePageRole("STAFF");
  const { status: statusParam, q } = await searchParams;
  const tab: TabKey = TABS.some((t) => t.key === statusParam) ? (statusParam as TabKey) : "PENDING";
  const loans = await listLoansForStaff({
    status: tab === "ALL" ? undefined : (tab as LoanStatus | "OVERDUE"),
    q,
  });
  const today = todayBangkok();
  const href = (status: TabKey) => `/staff/loans?status=${status}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">คำขอยืม</h1>
      <nav className="flex gap-1 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={href(t.key)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm whitespace-nowrap",
              tab === t.key ? "bg-primary text-primary-foreground" : "hover:bg-muted",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <form className="flex gap-2">
        <input type="hidden" name="status" value={tab} />
        <Input name="q" defaultValue={q ?? ""} placeholder="ค้นหาชื่อผู้ยืม" />
        <Button type="submit" size="lg">
          ค้นหา
        </Button>
      </form>

      {loans.length === 0 ? (
        <p className="text-sm text-muted-foreground">ไม่มีรายการ</p>
      ) : (
        <ul className="space-y-2">
          {loans.map((l) => (
            <li key={l.id}>
              <Link href={`/staff/loans/${l.id}`} className="block space-y-1 rounded-lg border p-3 hover:bg-muted">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{l.borrower.name}</span>
                  <LoanStatusBadge status={l.status} overdue={isOverdue(l, today)} />
                </div>
                <p className="text-sm">
                  {formatThaiDate(l.startDate)} ถึง {formatThaiDate(l.dueDate)}
                  <span className="text-muted-foreground"> · {l.borrower.department}</span>
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {l.items.map((i) => `${i.item.name} x${i.quantity}`).join(", ")}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

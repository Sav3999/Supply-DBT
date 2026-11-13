import Link from "next/link";
import { LoanStatusBadge } from "@/components/loan-status-badge";
import { formatDateOnly, todayBangkok } from "@/lib/dates";
import { requirePageRole } from "@/server/auth/session";
import { listMyLoans } from "@/server/loans/request";
import { isOverdue } from "@/server/loans/status";

export default async function MyLoansPage() {
  const user = await requirePageRole("BORROWER", "STAFF", "ADMIN");
  const loans = await listMyLoans(user);
  const today = todayBangkok();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">คำขอของฉัน</h1>
      {loans.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          ยังไม่มีคำขอ{" "}
          <Link href="/items" className="underline">
            เลือกของที่ต้องการยืม
          </Link>
        </p>
      ) : (
        <ul className="space-y-2">
          {loans.map((l) => (
            <li key={l.id}>
              <Link href={`/my-loans/${l.id}`} className="block space-y-1 rounded-lg border p-3 hover:bg-muted">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm">
                    {formatDateOnly(l.startDate)} ถึง {formatDateOnly(l.dueDate)}
                  </span>
                  <LoanStatusBadge status={l.status} overdue={isOverdue(l, today)} />
                </div>
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

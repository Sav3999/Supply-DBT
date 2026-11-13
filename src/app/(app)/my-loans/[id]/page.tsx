import { notFound } from "next/navigation";
import { LoanStatusBadge } from "@/components/loan-status-badge";
import { formatDateOnly, todayBangkok } from "@/lib/dates";
import { AppError } from "@/lib/result";
import { requirePageRole } from "@/server/auth/session";
import { getLoanForUser, type LoanWithItems } from "@/server/loans/request";
import { isOverdue } from "@/server/loans/status";
import { CancelButton } from "../cancel-button";

export default async function MyLoanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageRole("BORROWER", "STAFF", "ADMIN");
  const { id } = await params;
  let loan: LoanWithItems;
  try {
    loan = await getLoanForUser(user, id);
  } catch (e) {
    if (e instanceof AppError) notFound();
    throw e;
  }
  const isOwner = loan.borrowerId === user.id;
  const canCancel =
    (isOwner && (loan.status === "PENDING" || loan.status === "APPROVED")) ||
    (!isOwner && user.role !== "BORROWER" && loan.status === "APPROVED");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">รายละเอียดคำขอ</h1>
        <LoanStatusBadge status={loan.status} overdue={isOverdue(loan, todayBangkok())} />
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">วันยืม</dt>
        <dd>{formatDateOnly(loan.startDate)}</dd>
        <dt className="text-muted-foreground">กำหนดคืน</dt>
        <dd>{formatDateOnly(loan.dueDate)}</dd>
        <dt className="text-muted-foreground">เหตุผล</dt>
        <dd className="whitespace-pre-wrap">{loan.purpose}</dd>
        {loan.rejectReason && (
          <>
            <dt className="text-muted-foreground">เหตุผลที่ไม่อนุมัติ</dt>
            <dd>{loan.rejectReason}</dd>
          </>
        )}
      </dl>
      <ul className="divide-y rounded-lg border">
        {loan.items.map((i) => (
          <li key={i.id} className="flex items-center justify-between gap-2 p-3 text-sm">
            <span>{i.item.name}</span>
            <span>
              {i.quantity} ชิ้น
              {loan.status === "BORROWED" || loan.status === "RETURNED" ? ` (คืนแล้ว ${i.returnedQuantity})` : ""}
            </span>
          </li>
        ))}
      </ul>
      {canCancel && <CancelButton loanId={loan.id} />}
    </div>
  );
}

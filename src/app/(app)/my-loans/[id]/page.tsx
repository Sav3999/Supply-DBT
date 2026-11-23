import type { LoanStatus } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LoanStatusBadge } from "@/components/loan-status-badge";
import { formatThaiDate, todayBangkok } from "@/lib/dates";
import { AppError } from "@/lib/result";
import { requirePageRole } from "@/server/auth/session";
import { getLoanForUser, type LoanWithItems } from "@/server/loans/request";
import { isOverdue } from "@/server/loans/status";
import { CancelButton } from "../cancel-button";

const NEXT_STEP: Record<LoanStatus, string> = {
  PENDING: "รอเจ้าหน้าที่พิจารณา คุณจะได้แจ้งเตือนเมื่ออนุมัติหรือปฏิเสธ",
  APPROVED: "อนุมัติแล้ว — ไปรับของกับเจ้าหน้าที่ได้ตั้งแต่วันยืม",
  BORROWED: "รับของแล้ว — นำมาคืนเจ้าหน้าที่ภายในวันกำหนดคืน ระบบจะเตือนล่วงหน้า 1 วัน",
  RETURNED: "คืนของครบแล้ว ขอบคุณที่ใช้บริการ",
  REJECTED: "คำขอนี้ถูกปฏิเสธ ดูเหตุผลด้านล่าง ส่งคำขอใหม่ได้ที่เมนู “รายการของ”",
  CANCELLED: "คำขอนี้ถูกยกเลิกแล้ว",
};

export default async function MyLoanDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sent?: string }>;
}) {
  const user = await requirePageRole("BORROWER", "STAFF", "ADMIN");
  const { id } = await params;
  const { sent } = await searchParams;
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
      {sent && isOwner && (
        <div role="status" className="rounded-lg border border-green-600/30 bg-green-600/10 p-3 text-sm">
          <p className="font-medium">ส่งคำขอเรียบร้อยแล้ว ✓</p>
          <p>
            รอเจ้าหน้าที่อนุมัติ ดูคำขอทั้งหมดได้ที่เมนู{" "}
            <Link href="/my-loans" className="text-primary underline-offset-4 hover:underline">
              คำขอของฉัน
            </Link>{" "}
            เมื่อมีความคืบหน้าคุณจะได้แจ้งเตือนที่กระดิ่ง 🔔 และ LINE (ถ้าผูกไว้ที่หน้าโปรไฟล์)
          </p>
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">รายละเอียดคำขอ</h1>
        <LoanStatusBadge status={loan.status} overdue={isOverdue(loan, todayBangkok())} />
      </div>
      {isOwner && <p className="text-sm text-muted-foreground">ขั้นต่อไป: {NEXT_STEP[loan.status]}</p>}
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">วันยืม</dt>
        <dd>{formatThaiDate(loan.startDate)}</dd>
        <dt className="text-muted-foreground">กำหนดคืน</dt>
        <dd>{formatThaiDate(loan.dueDate)}</dd>
        <dt className="text-muted-foreground">เหตุผล</dt>
        <dd className="whitespace-pre-wrap">{loan.purpose}</dd>
        {loan.rejectReason && (
          <>
            <dt className="text-muted-foreground">เหตุผลที่ปฏิเสธ</dt>
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

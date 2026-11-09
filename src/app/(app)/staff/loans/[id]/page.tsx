import Link from "next/link";
import { notFound } from "next/navigation";
import { LoanStatusBadge } from "@/components/loan-status-badge";
import { formatDateOnly, todayBangkok } from "@/lib/dates";
import { AppError } from "@/lib/result";
import { requireRole } from "@/server/auth/session";
import { getLoanForStaff, type StaffLoanDetail } from "@/server/loans/staff";
import { isOverdue } from "@/server/loans/status";
import { approveAction, cancelAction, handOverAction, rejectAction, returnAction } from "../actions";
import { ActionButton, CONDITION_LABEL, HandOverForm, RejectForm, ReturnForm } from "../loan-controls";

const dateTime = new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" });

export default async function StaffLoanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("STAFF");
  const { id } = await params;
  let loan: StaffLoanDetail;
  try {
    loan = await getLoanForStaff(id);
  } catch (e) {
    if (e instanceof AppError) notFound();
    throw e;
  }
  const showReturned = loan.status === "BORROWED" || loan.status === "RETURNED";

  return (
    <div className="space-y-4">
      <Link href="/staff/loans" className="text-sm underline">
        กลับไปรายการคำขอ
      </Link>
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">คำขอยืม</h1>
        <LoanStatusBadge status={loan.status} overdue={isOverdue(loan, todayBangkok())} />
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">ผู้ยืม</dt>
        <dd>{loan.borrower.name}</dd>
        <dt className="text-muted-foreground">แผนก</dt>
        <dd>{loan.borrower.department}</dd>
        <dt className="text-muted-foreground">โทร</dt>
        <dd>
          <a href={`tel:${loan.borrower.phone}`} className="underline">
            {loan.borrower.phone}
          </a>
        </dd>
        <dt className="text-muted-foreground">วันยืม</dt>
        <dd>{formatDateOnly(loan.startDate)}</dd>
        <dt className="text-muted-foreground">กำหนดคืน</dt>
        <dd>{formatDateOnly(loan.dueDate)}</dd>
        <dt className="text-muted-foreground">เหตุผล</dt>
        <dd className="whitespace-pre-wrap">{loan.purpose}</dd>
        {loan.approver && (
          <>
            <dt className="text-muted-foreground">{loan.status === "REJECTED" ? "ผู้ปฏิเสธ" : "ผู้อนุมัติ"}</dt>
            <dd>{loan.approver.name}</dd>
          </>
        )}
        {loan.rejectReason && (
          <>
            <dt className="text-muted-foreground">เหตุผลที่ไม่อนุมัติ</dt>
            <dd>{loan.rejectReason}</dd>
          </>
        )}
        {loan.handedOverAt && (
          <>
            <dt className="text-muted-foreground">ส่งมอบเมื่อ</dt>
            <dd>{dateTime.format(loan.handedOverAt)}</dd>
          </>
        )}
        {loan.returnedAt && (
          <>
            <dt className="text-muted-foreground">คืนครบเมื่อ</dt>
            <dd>{dateTime.format(loan.returnedAt)}</dd>
          </>
        )}
      </dl>

      <ul className="divide-y rounded-lg border">
        {loan.items.map((i) => (
          <li key={i.id} className="space-y-1 p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span>{i.item.name}</span>
              <span>
                {i.quantity} ชิ้น{showReturned ? ` (คืนแล้ว ${i.returnedQuantity})` : ""}
              </span>
            </div>
            {i.assets.length > 0 && (
              <ul className="flex flex-wrap gap-1">
                {i.assets.map((a) => (
                  <li key={a.assetId} className="rounded border px-2 py-0.5 text-xs">
                    {a.asset.assetTag}
                    {a.returnedAt
                      ? ` · คืนแล้ว${a.condition ? ` (${CONDITION_LABEL[a.condition]})` : ""}`
                      : " · ยังไม่คืน"}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>

      {loan.status === "PENDING" && (
        <div className="space-y-3">
          <ActionButton action={approveAction} loanId={loan.id} label="อนุมัติ" />
          <RejectForm action={rejectAction} loanId={loan.id} />
        </div>
      )}

      {loan.status === "APPROVED" && (
        <div className="space-y-3">
          <HandOverForm
            action={handOverAction}
            loanId={loan.id}
            lines={loan.items.map((i) => ({
              id: i.id,
              name: i.item.name,
              quantity: i.quantity,
              serialized: i.item.kind === "SERIALIZED",
              available: i.availableAssets.map((a) => ({ id: a.id, assetTag: a.assetTag })),
            }))}
          />
          <ActionButton
            action={cancelAction}
            loanId={loan.id}
            label="ยกเลิกคำขอ"
            variant="destructive"
            confirmText="ยืนยันการยกเลิกคำขอนี้?"
          />
        </div>
      )}

      {loan.status === "BORROWED" && (
        <ReturnForm
          action={returnAction}
          loanId={loan.id}
          lines={loan.items
            .filter((i) => i.returnedQuantity < i.quantity)
            .map((i) => ({
              id: i.id,
              name: i.item.name,
              serialized: i.item.kind === "SERIALIZED",
              outstanding: i.quantity - i.returnedQuantity,
              assets: i.assets
                .filter((a) => !a.returnedAt)
                .map((a) => ({ id: a.assetId, assetTag: a.asset.assetTag })),
            }))}
        />
      )}
    </div>
  );
}

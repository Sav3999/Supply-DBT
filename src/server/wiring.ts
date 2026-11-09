import type { Loan } from "@prisma/client";
import { formatThaiDate } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { setUserRegisteredHandler } from "@/server/auth/register";
import { setLoanEventHandler, type LoanEvent } from "@/server/loans/events";
import { notify, notifyRoles } from "@/server/notifications";

let wired = false;

async function onLoanEvent(event: LoanEvent, loan: Loan): Promise<void> {
  const mine = `/my-loans/${loan.id}`;
  switch (event) {
    case "CREATED": {
      const [borrower, count] = await Promise.all([
        prisma.user.findUniqueOrThrow({ where: { id: loan.borrowerId }, select: { name: true } }),
        prisma.loanItem.count({ where: { loanId: loan.id } }),
      ]);
      await notifyRoles(["STAFF", "ADMIN"], `คำขอยืมใหม่จาก ${borrower.name} (${count} รายการ)`, `/staff/loans/${loan.id}`);
      return;
    }
    case "APPROVED":
      return notify([loan.borrowerId], `คำขอยืมได้รับอนุมัติ มารับของได้ตั้งแต่ ${formatThaiDate(loan.startDate)}`, mine);
    case "REJECTED":
      return notify([loan.borrowerId], `คำขอยืมถูกปฏิเสธ: ${loan.rejectReason ?? "-"}`, mine);
    case "HANDED_OVER":
      return notify([loan.borrowerId], `รับของเรียบร้อย กำหนดคืน ${formatThaiDate(loan.dueDate)}`, mine);
    case "RETURNED":
      return notify([loan.borrowerId], "คืนของครบเรียบร้อย ขอบคุณครับ", mine);
    case "CANCELLED":
      return; // spec lists no notification
  }
}

/** ต่อ hook ทั้งหมดครั้งเดียว (idempotent) */
export function ensureWired(): void {
  if (wired) return;
  wired = true;
  setLoanEventHandler(onLoanEvent);
  setUserRegisteredHandler(async (user) => {
    await notifyRoles(["ADMIN"], `มีผู้สมัครใหม่: ${user.name} (${user.department})`, "/admin/users");
  });
}

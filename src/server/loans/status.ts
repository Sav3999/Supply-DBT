import type { LoanStatus, Prisma } from "@prisma/client";
import type { Db } from "@/lib/db";
import { AppError } from "@/lib/result";

/** เกินกำหนด = ยังไม่คืน (BORROWED) และกำหนดคืนผ่านมาแล้ว (today คือวันที่ตามเวลาไทย) */
export function isOverdue(loan: { status: LoanStatus; dueDate: Date }, today: Date): boolean {
  return loan.status === "BORROWED" && loan.dueDate.getTime() < today.getTime();
}

/** เปลี่ยนสถานะแบบมีเงื่อนไข (กันกดซ้ำ/แข่งกัน): ต้องอยู่ในสถานะ `from` เท่านั้น */
export async function transition(
  db: Db,
  loanId: string,
  from: LoanStatus[],
  data: Prisma.LoanUncheckedUpdateManyInput,
): Promise<void> {
  const res = await db.loan.updateMany({ where: { id: loanId, status: { in: from } }, data });
  if (res.count === 0) throw new AppError("รายการนี้ถูกดำเนินการไปแล้ว");
}

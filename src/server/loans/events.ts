import type { Loan } from "@prisma/client";

export type LoanEvent = "CREATED" | "APPROVED" | "REJECTED" | "HANDED_OVER" | "RETURNED" | "CANCELLED";

type Handler = (event: LoanEvent, loan: Loan) => Promise<void>;

let handler: Handler = async () => {};

/** Task 9 ติดตั้ง handler (แจ้งเตือน); ค่าเริ่มต้นไม่ทำอะไร */
export function setLoanEventHandler(fn: Handler): void {
  handler = fn;
}

/** เรียกหลัง transaction commit เท่านั้น; ความล้มเหลวของ handler ต้องไม่ทำให้ action หลักล้ม */
export async function emitLoanEvent(event: LoanEvent, loan: Loan): Promise<void> {
  try {
    await handler(event, loan);
  } catch (e) {
    console.error(`loan event handler failed (${event}, loan ${loan.id})`, e);
  }
}

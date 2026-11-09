import { diffDaysInclusive } from "@/lib/dates";

export { isOverdue } from "./status";

/** ตรวจวันยืม/วันคืน; คืนข้อความ error ภาษาไทย หรือ null ถ้าถูกต้อง */
export function validateLoanDates(start: Date, due: Date, maxLoanDays: number[], today: Date): string | null {
  if (start.getTime() < today.getTime()) return "วันยืมต้องไม่ก่อนวันนี้";
  if (due.getTime() < start.getTime()) return "วันคืนต้องไม่ก่อนวันยืม";
  if (maxLoanDays.length > 0) {
    const max = Math.min(...maxLoanDays);
    if (diffDaysInclusive(start, due) > max) return `ยืมได้ไม่เกิน ${max} วัน`;
  }
  return null;
}

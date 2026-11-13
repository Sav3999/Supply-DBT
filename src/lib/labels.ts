// Plain (non-"use client") module so server components can read these maps.
// Exports of a "use client" file are opaque references on the server (values come back undefined).
export const CONDITION_LABEL = { GOOD: "ปกติ", DAMAGED: "ชำรุด", LOST: "สูญหาย" } as const;
export const ROLE_LABEL = { BORROWER: "ผู้ยืม", STAFF: "เจ้าหน้าที่", ADMIN: "แอดมิน" } as const;
/** ป้ายสถานะคำขอยืม — ใช้ทั้งแอป (badge, ตารางประวัติ, CSV) */
export const LOAN_STATUS_LABEL = {
  PENDING: "รออนุมัติ",
  APPROVED: "อนุมัติแล้ว",
  BORROWED: "กำลังยืม",
  RETURNED: "คืนแล้ว",
  REJECTED: "ปฏิเสธ",
  CANCELLED: "ยกเลิก",
} as const satisfies Record<import("@prisma/client").LoanStatus, string>;

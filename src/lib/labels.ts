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

/** ชื่อภาษาไทยของการกระทำในบันทึกการใช้งาน (AuditLog.action) — โค้ดใหม่ต้องเพิ่มที่นี่ด้วย (มีเทสต์ตรวจ) */
export const AUDIT_ACTION_LABEL: Record<string, string> = {
  LOAN_CREATE: "ส่งคำขอยืม",
  LOAN_CANCEL: "ยกเลิกคำขอยืม",
  LOAN_APPROVE: "อนุมัติคำขอยืม",
  LOAN_REJECT: "ปฏิเสธคำขอยืม",
  LOAN_HANDOVER: "ส่งมอบของ",
  LOAN_RETURN: "รับคืนของ",
  ITEM_CREATE: "เพิ่มรายการของ",
  ITEM_UPDATE: "แก้ไขรายการของ",
  ITEM_IMAGE_REMOVE: "ลบรูปของ",
  ITEM_DELETE: "ลบรายการของ",
  ASSET_ADD: "เพิ่มเลขครุภัณฑ์",
  ASSET_STATUS: "เปลี่ยนสถานะครุภัณฑ์",
  ASSET_DELETE: "ลบเลขครุภัณฑ์",
  CATEGORY_CREATE: "เพิ่มหมวดหมู่",
  CATEGORY_RENAME: "แก้ชื่อหมวดหมู่",
  CATEGORY_DELETE: "ลบหมวดหมู่",
  USER_APPROVE: "ยืนยันผู้สมัคร",
  USER_REJECT: "ปฏิเสธผู้สมัคร",
  USER_SUSPEND: "ระงับบัญชี",
  USER_ACTIVATE: "เปิดใช้บัญชี",
  USER_SET_ROLE: "เปลี่ยนบทบาท",
  USER_UPDATE_PROFILE: "แก้ไขโปรไฟล์",
  USER_CHANGE_PASSWORD: "เปลี่ยนรหัสผ่าน",
};

/** ชื่อภาษาไทยของชนิดข้อมูลในบันทึกการใช้งาน (AuditLog.entity) ตาม GLOSSARY */
export const AUDIT_ENTITY_LABEL: Record<string, string> = {
  Loan: "คำขอยืม",
  Item: "รายการของ",
  Asset: "ครุภัณฑ์",
  Category: "หมวดหมู่",
  User: "ผู้ใช้",
};

/** คืนชื่อไทย ถ้าไม่รู้จักคืนรหัสเดิม (กันบันทึกเก่าหรือรหัสใหม่ที่ยังไม่ได้ใส่ชื่อ) */
export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABEL[action] ?? action;
}

export function auditEntityLabel(entity: string): string {
  return AUDIT_ENTITY_LABEL[entity] ?? entity;
}

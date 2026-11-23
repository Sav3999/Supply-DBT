import type { Role } from "@prisma/client";

export type NavItem = { label: string; href: string };

const BORROWER: NavItem[] = [
  { label: "รายการของ", href: "/items" },
  { label: "คำขอของฉัน", href: "/my-loans" },
  { label: "โปรไฟล์", href: "/profile" },
];
const STAFF: NavItem[] = [
  { label: "แดชบอร์ด", href: "/staff" },
  { label: "คำขอยืม", href: "/staff/loans" },
  { label: "จัดการของ", href: "/staff/items" },
  { label: "ประวัติ", href: "/staff/history" },
];
const ADMIN: NavItem[] = [
  { label: "ผู้ใช้", href: "/admin/users" },
  { label: "หมวดหมู่", href: "/admin/categories" },
  { label: "Audit Log", href: "/admin/audit" },
];

const HELP: NavItem = { label: "วิธีใช้", href: "/help" };

export function navFor(role: Role): NavItem[] {
  if (role === "ADMIN") return [...BORROWER, ...STAFF, ...ADMIN, HELP];
  if (role === "STAFF") return [...BORROWER, ...STAFF, HELP];
  return [...BORROWER, HELP];
}

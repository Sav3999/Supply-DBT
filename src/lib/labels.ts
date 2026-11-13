// Plain (non-"use client") module so server components can read these maps.
// Exports of a "use client" file are opaque references on the server (values come back undefined).
export const CONDITION_LABEL = { GOOD: "ปกติ", DAMAGED: "ชำรุด", LOST: "สูญหาย" } as const;
export const ROLE_LABEL = { BORROWER: "ผู้ยืม", STAFF: "เจ้าหน้าที่", ADMIN: "แอดมิน" } as const;

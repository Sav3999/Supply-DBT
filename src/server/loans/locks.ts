import { Prisma } from "@prisma/client";

/**
 * ล็อกแถว Item (SELECT ... FOR UPDATE) เรียงตาม id เพื่อกัน deadlock
 * ใช้เป็นคำสั่งแรกของ transaction ที่ตรวจ/เปลี่ยนการจองของ (สร้างคำขอ อนุมัติ ส่งมอบ รับคืน)
 * updateItem (Task 5) ล็อกแถวเดียวกัน → การแก้ totalQuantity กับการจองไม่แทรกกัน
 */
export async function lockItems(tx: Prisma.TransactionClient, itemIds: string[]): Promise<void> {
  const ids = [...new Set(itemIds)].sort();
  if (ids.length === 0) return;
  await tx.$queryRaw(Prisma.sql`SELECT id FROM "Item" WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`);
}

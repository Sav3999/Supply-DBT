import type { Db } from "@/lib/db";

/** จำนวนที่ถูกยืมค้างอยู่ (Loan สถานะ BORROWED): ผลรวมของ quantity - returnedQuantity */
export async function outstandingQuantity(db: Db, itemId: string): Promise<number> {
  const rows = await db.loanItem.findMany({
    where: { itemId, loan: { status: "BORROWED" } },
    select: { quantity: true, returnedQuantity: true },
  });
  return rows.reduce((sum, r) => sum + (r.quantity - r.returnedQuantity), 0);
}

/**
 * จำนวนทั้งหมดที่ยืมได้ของของชิ้นนี้ (ของที่ inactive ทุกชนิด → 0)
 * SERIALIZED: นับ Asset สถานะ AVAILABLE/ON_LOAN; QUANTITY: totalQuantity
 */
export async function capacity(db: Db, itemId: string): Promise<number> {
  const item = await db.item.findUnique({
    where: { id: itemId },
    select: { kind: true, active: true, totalQuantity: true },
  });
  if (!item || !item.active) return 0;
  if (item.kind === "QUANTITY") return item.totalQuantity;
  return db.asset.count({ where: { itemId, status: { in: ["AVAILABLE", "ON_LOAN"] } } });
}

/**
 * จำนวนที่ถูกจอง/ใช้อยู่ในช่วง [start, due]: Loan APPROVED/BORROWED ที่ช่วงวันซ้อนกัน
 * หรือ BORROWED ที่เกินกำหนดแล้วยังไม่คืน (dueDate < start) — นับ quantity - returnedQuantity
 */
export async function reservedQuantity(
  db: Db,
  itemId: string,
  start: Date,
  due: Date,
  excludeLoanId?: string,
): Promise<number> {
  const rows = await db.loanItem.findMany({
    where: {
      itemId,
      loan: {
        ...(excludeLoanId ? { id: { not: excludeLoanId } } : {}),
        OR: [
          { status: { in: ["APPROVED", "BORROWED"] }, startDate: { lte: due }, dueDate: { gte: start } },
          { status: "BORROWED", dueDate: { lt: start } },
        ],
      },
    },
    select: { quantity: true, returnedQuantity: true },
  });
  return rows.reduce((sum, r) => sum + (r.quantity - r.returnedQuantity), 0);
}

/** max(0, capacity - reserved) — ไม่ติดลบแม้ capacity ถูกลดหลังอนุมัติ */
export async function availableQuantity(
  db: Db,
  itemId: string,
  start: Date,
  due: Date,
  excludeLoanId?: string,
): Promise<number> {
  const [cap, reserved] = await Promise.all([
    capacity(db, itemId),
    reservedQuantity(db, itemId, start, due, excludeLoanId),
  ]);
  return Math.max(0, cap - reserved);
}

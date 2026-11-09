import type { Db } from "@/lib/db";

/** จำนวนที่ถูกยืมค้างอยู่ (Loan สถานะ BORROWED): ผลรวมของ quantity - returnedQuantity */
export async function outstandingQuantity(db: Db, itemId: string): Promise<number> {
  const rows = await db.loanItem.findMany({
    where: { itemId, loan: { status: "BORROWED" } },
    select: { quantity: true, returnedQuantity: true },
  });
  return rows.reduce((sum, r) => sum + (r.quantity - r.returnedQuantity), 0);
}

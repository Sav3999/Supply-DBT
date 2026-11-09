import { Prisma, type Asset, type Condition, type Item, type Loan, type LoanAsset, type LoanItem, type LoanStatus, type User } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { todayBangkok } from "@/lib/dates";
import { AppError } from "@/lib/result";
import { logAudit } from "@/server/audit";
import { assertRole, type SessionUser } from "@/server/auth/session";
import { availableQuantity } from "./availability";
import { emitLoanEvent } from "./events";
import { lockItems } from "./locks";
import { transition } from "./status";

const ALREADY = "รายการนี้ถูกดำเนินการไปแล้ว";
const ASSET_BUSY = "เลขครุภัณฑ์นี้ถูกยืมอยู่";
const ASSET_COUNT = "กรุณาเลือกเลขครุภัณฑ์ให้ครบ";
const ALREADY_RETURNED = "ชิ้นนี้คืนไปแล้ว";
const OVER_RETURN = "จำนวนคืนเกินจำนวนที่ค้าง";
const MAX_RETRIES = 3;

type Tx = Prisma.TransactionClient;

/** อ่าน Loan + LoanItem แล้วล็อกแถว Item ที่เกี่ยวข้อง (LoanItem ของ Loan ไม่เปลี่ยน จึงอ่านก่อนล็อกได้) */
async function lockLoan(tx: Tx, loanId: string) {
  const ids = await tx.loanItem.findMany({ where: { loanId }, select: { itemId: true } });
  await lockItems(tx, ids.map((i) => i.itemId));
  const loan = await tx.loan.findUnique({
    where: { id: loanId },
    include: { items: { include: { item: true }, orderBy: { id: "asc" } } },
  });
  if (!loan) throw new AppError("ไม่พบคำขอ");
  return loan;
}

function isSerializationFailure(e: unknown): boolean {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (e.code === "P2034") return true;
  // raw queries surface the Postgres code inside P2010
  return e.code === "P2010" && /40001|40P01/.test(e.message);
}

// ---------- approve ----------

export async function approveLoan(actor: SessionUser, loanId: string): Promise<void> {
  assertRole(actor, "STAFF");
  let approved: Loan | undefined;
  for (let attempt = 0; ; attempt++) {
    try {
      approved = await prisma.$transaction(
        async (tx) => {
          const loan = await lockLoan(tx, loanId);
          if (loan.status !== "PENDING") throw new AppError(ALREADY);
          for (const li of loan.items) {
            const free = await availableQuantity(tx, li.itemId, loan.startDate, loan.dueDate, loanId);
            if (free < li.quantity) throw new AppError(`ของไม่พอในช่วงวันที่เลือก: ${li.item.name}`);
          }
          await transition(tx, loanId, ["PENDING"], {
            status: "APPROVED",
            approverId: actor.id,
            approvedAt: new Date(),
          });
          await logAudit(tx, { actorId: actor.id, action: "LOAN_APPROVE", entity: "Loan", entityId: loanId });
          return tx.loan.findUniqueOrThrow({ where: { id: loanId } });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      break;
    } catch (e) {
      if (attempt < MAX_RETRIES && isSerializationFailure(e)) continue;
      throw e;
    }
  }
  await emitLoanEvent("APPROVED", approved);
}

// ---------- reject ----------

export async function rejectLoan(actor: SessionUser, loanId: string, reason: string): Promise<void> {
  assertRole(actor, "STAFF");
  const r = (reason ?? "").trim();
  if (!r) throw new AppError("กรุณาระบุเหตุผล");
  if (r.length > 500) throw new AppError("เหตุผลยาวเกิน 500 ตัวอักษร");
  const rejected = await prisma.$transaction(async (tx) => {
    if (!(await tx.loan.findUnique({ where: { id: loanId }, select: { id: true } }))) {
      throw new AppError("ไม่พบคำขอ");
    }
    await transition(tx, loanId, ["PENDING"], {
      status: "REJECTED",
      rejectReason: r,
      approverId: actor.id,
    });
    await logAudit(tx, { actorId: actor.id, action: "LOAN_REJECT", entity: "Loan", entityId: loanId, data: { reason: r } });
    return tx.loan.findUniqueOrThrow({ where: { id: loanId } });
  });
  await emitLoanEvent("REJECTED", rejected);
}

// ---------- handover ----------

const handOverSchema = z.object({
  assets: z.record(z.string(), z.array(z.string().min(1))),
});
export type HandOverInput = z.input<typeof handOverSchema>;

export async function handOverLoan(actor: SessionUser, loanId: string, input: HandOverInput): Promise<void> {
  assertRole(actor, "STAFF");
  const v = handOverSchema.parse(input);
  const handed = await prisma.$transaction(async (tx) => {
    const loan = await lockLoan(tx, loanId);
    if (loan.status !== "APPROVED") throw new AppError(ALREADY);

    const lineIds = new Set(loan.items.map((i) => i.id));
    for (const key of Object.keys(v.assets)) {
      if (!lineIds.has(key) && v.assets[key].length > 0) throw new AppError("ไม่พบรายการในคำขอ");
    }

    const plan: { loanItemId: string; assetIds: string[] }[] = [];
    const seen = new Set<string>();
    for (const li of loan.items) {
      const picked = [...new Set(v.assets[li.id] ?? [])];
      if (li.item.kind === "QUANTITY") {
        if (picked.length > 0) throw new AppError("ของนี้ไม่มีเลขครุภัณฑ์");
        continue;
      }
      if (picked.length !== li.quantity) throw new AppError(ASSET_COUNT);
      const assets = await tx.asset.findMany({ where: { id: { in: picked } } });
      if (assets.length !== picked.length || assets.some((a) => a.itemId !== li.itemId)) {
        throw new AppError("เลขครุภัณฑ์ไม่ตรงกับของที่ยืม");
      }
      if (assets.some((a) => a.status !== "AVAILABLE")) throw new AppError(ASSET_BUSY);
      for (const id of picked) {
        if (seen.has(id)) throw new AppError(ASSET_COUNT);
        seen.add(id);
      }
      plan.push({ loanItemId: li.id, assetIds: picked });
    }

    for (const p of plan) {
      // conditional update = the real guard against two handovers grabbing the same asset
      const { count } = await tx.asset.updateMany({
        where: { id: { in: p.assetIds }, status: "AVAILABLE" },
        data: { status: "ON_LOAN" },
      });
      if (count !== p.assetIds.length) throw new AppError(ASSET_BUSY);
      await tx.loanAsset.createMany({ data: p.assetIds.map((assetId) => ({ loanItemId: p.loanItemId, assetId })) });
    }
    await transition(tx, loanId, ["APPROVED"], { status: "BORROWED", handedOverAt: new Date() });
    await logAudit(tx, {
      actorId: actor.id,
      action: "LOAN_HANDOVER",
      entity: "Loan",
      entityId: loanId,
      data: { assets: plan },
    });
    return tx.loan.findUniqueOrThrow({ where: { id: loanId } });
  });
  await emitLoanEvent("HANDED_OVER", handed);
}

// ---------- return ----------

const condition = z.enum(["GOOD", "DAMAGED", "LOST"], { message: "สภาพไม่ถูกต้อง" });
const returnSchema = z.object({
  serialized: z.array(z.object({ loanItemId: z.string().min(1), assetId: z.string().min(1), condition })),
  quantity: z.array(
    z.object({
      loanItemId: z.string().min(1),
      quantity: z.number().int("จำนวนต้องเป็นจำนวนเต็ม").min(1, "จำนวนต้องไม่น้อยกว่า 1"),
      condition,
    }),
  ),
});
export type ReturnInput = z.input<typeof returnSchema>;

const ASSET_STATUS_AFTER: Record<Condition, "AVAILABLE" | "REPAIR" | "LOST"> = {
  GOOD: "AVAILABLE",
  DAMAGED: "REPAIR",
  LOST: "LOST",
};

export async function receiveReturn(actor: SessionUser, loanId: string, input: ReturnInput): Promise<void> {
  assertRole(actor, "STAFF");
  const v = returnSchema.parse(input);
  if (v.serialized.length === 0 && v.quantity.length === 0) throw new AppError("กรุณาเลือกรายการที่คืน");

  const done = await prisma.$transaction(async (tx) => {
    // item locks serialize concurrent returns of this loan (double submit) — re-read after locking
    const loan = await lockLoan(tx, loanId);
    if (loan.status !== "BORROWED") throw new AppError(ALREADY);
    const lines = new Map(loan.items.map((i) => [i.id, i]));
    const now = new Date();
    const added = new Map<string, number>();

    for (const s of v.serialized) {
      const li = lines.get(s.loanItemId);
      if (!li || li.item.kind !== "SERIALIZED") throw new AppError("ไม่พบรายการในคำขอ");
      const { count } = await tx.loanAsset.updateMany({
        where: { loanItemId: s.loanItemId, assetId: s.assetId, returnedAt: null },
        data: { returnedAt: now, condition: s.condition },
      });
      if (count !== 1) throw new AppError(ALREADY_RETURNED);
      await tx.asset.update({ where: { id: s.assetId }, data: { status: ASSET_STATUS_AFTER[s.condition] } });
      added.set(li.id, (added.get(li.id) ?? 0) + 1);
    }
    for (const q of v.quantity) {
      const li = lines.get(q.loanItemId);
      if (!li || li.item.kind !== "QUANTITY") throw new AppError("ไม่พบรายการในคำขอ");
      added.set(li.id, (added.get(li.id) ?? 0) + q.quantity);
    }

    for (const [id, n] of added) {
      const li = lines.get(id)!;
      if (li.returnedQuantity + n > li.quantity) throw new AppError(OVER_RETURN);
      // optimistic guard on top of the lock: must still hold the value we validated against
      const { count } = await tx.loanItem.updateMany({
        where: { id, returnedQuantity: li.returnedQuantity },
        data: { returnedQuantity: li.returnedQuantity + n },
      });
      if (count !== 1) throw new AppError(ALREADY);
      li.returnedQuantity += n;
    }

    const complete = loan.items.every((i) => i.returnedQuantity === i.quantity);
    if (complete) await transition(tx, loanId, ["BORROWED"], { status: "RETURNED", returnedAt: now });
    await logAudit(tx, {
      actorId: actor.id,
      action: "LOAN_RETURN",
      entity: "Loan",
      entityId: loanId,
      data: { serialized: v.serialized, quantity: v.quantity, complete },
    });
    return complete ? tx.loan.findUniqueOrThrow({ where: { id: loanId } }) : null;
  });
  if (done) await emitLoanEvent("RETURNED", done);
}

// ---------- queries ----------

export type StaffLoanFilter = { status?: LoanStatus | "OVERDUE"; q?: string };

const borrowerSelect = { id: true, name: true, email: true, department: true, phone: true } as const;
type BorrowerInfo = Pick<User, "id" | "name" | "email" | "department" | "phone">;

export type StaffLoanRow = Loan & { borrower: BorrowerInfo; items: (LoanItem & { item: Item })[] };

export async function listLoansForStaff(filter: StaffLoanFilter = {}): Promise<StaffLoanRow[]> {
  const where: Prisma.LoanWhereInput = {};
  if (filter.status === "OVERDUE") {
    where.status = "BORROWED";
    where.dueDate = { lt: todayBangkok() };
  } else if (filter.status) {
    where.status = filter.status;
  }
  const q = filter.q?.trim();
  if (q) where.borrower = { name: { contains: q, mode: "insensitive" } };
  return prisma.loan.findMany({
    where,
    orderBy: filter.status === "OVERDUE" ? { dueDate: "asc" } : { createdAt: "desc" },
    take: 200,
    include: {
      borrower: { select: borrowerSelect },
      items: { include: { item: true }, orderBy: { id: "asc" } },
    },
  });
}

export type StaffLoanDetail = Loan & {
  borrower: BorrowerInfo;
  approver: { id: string; name: string } | null;
  items: (LoanItem & {
    item: Item;
    assets: (LoanAsset & { asset: Asset })[];
    /** SERIALIZED: Asset ของ Item นี้ที่ AVAILABLE (สำหรับเลือกตอนส่งมอบ); QUANTITY: [] */
    availableAssets: Asset[];
  })[];
};

export async function getLoanForStaff(loanId: string): Promise<StaffLoanDetail> {
  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    include: {
      borrower: { select: borrowerSelect },
      approver: { select: { id: true, name: true } },
      items: {
        include: { item: true, assets: { include: { asset: true }, orderBy: { asset: { assetTag: "asc" } } } },
        orderBy: { id: "asc" },
      },
    },
  });
  if (!loan) throw new AppError("ไม่พบคำขอ");
  const serializedIds = loan.items.filter((i) => i.item.kind === "SERIALIZED").map((i) => i.itemId);
  const free = serializedIds.length
    ? await prisma.asset.findMany({
        where: { itemId: { in: serializedIds }, status: "AVAILABLE" },
        orderBy: { assetTag: "asc" },
      })
    : [];
  return {
    ...loan,
    items: loan.items.map((i) => ({ ...i, availableAssets: free.filter((a) => a.itemId === i.itemId) })),
  };
}

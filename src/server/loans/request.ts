import type { Loan, LoanItem, Item } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { formatDateOnly, parseDateOnly, todayBangkok } from "@/lib/dates";
import { AppError } from "@/lib/result";
import { logAudit } from "@/server/audit";
import type { SessionUser } from "@/server/auth/session";
import { availableQuantity } from "./availability";
import { validateLoanDates } from "./dates";
import { emitLoanEvent } from "./events";
import { lockItems } from "./locks";
import { transition } from "./status";

const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "รูปแบบวันที่ไม่ถูกต้อง")
  .refine((s) => formatDateOnly(parseDateOnly(s)) === s, "วันที่ไม่ถูกต้อง");

export const loanRequestSchema = z.object({
  startDate: dateStr,
  dueDate: dateStr,
  purpose: z.string().trim().min(1, "กรุณากรอกเหตุผลการยืม").max(500, "เหตุผลยาวเกิน 500 ตัวอักษร"),
  items: z
    .array(
      z.object({
        itemId: z.string().min(1),
        quantity: z.number().int("จำนวนต้องเป็นจำนวนเต็ม").min(1, "จำนวนต้องไม่น้อยกว่า 1"),
      }),
    )
    .min(1, "กรุณาเลือกของอย่างน้อย 1 รายการ")
    .refine((l) => new Set(l.map((i) => i.itemId)).size === l.length, "มีของซ้ำในรายการ"),
});
export type LoanRequestInput = z.input<typeof loanRequestSchema>;

export type LoanWithItems = Loan & { items: (LoanItem & { item: Item })[] };

export async function createLoan(actor: SessionUser, input: unknown, now: Date = new Date()): Promise<Loan> {
  const v = loanRequestSchema.parse(input);
  const start = parseDateOnly(v.startDate);
  const due = parseDateOnly(v.dueDate);

  const loan = await prisma.$transaction(async (tx) => {
    const ids = v.items.map((i) => i.itemId);
    // lock item rows (sorted → no deadlocks) so concurrent approvals/edits can't oversubscribe
    await lockItems(tx, ids);
    const items = await tx.item.findMany({ where: { id: { in: ids } } });
    const byId = new Map(items.map((i) => [i.id, i]));
    for (const line of v.items) {
      const item = byId.get(line.itemId);
      if (!item) throw new AppError("ไม่พบของที่เลือก");
      if (!item.active) throw new AppError(`ของนี้ปิดใช้งานแล้ว: ${item.name}`);
    }
    const err = validateLoanDates(start, due, items.map((i) => i.maxLoanDays), todayBangkok(now));
    if (err) throw new AppError(err);
    const short: string[] = [];
    for (const line of v.items) {
      const item = byId.get(line.itemId)!;
      if ((await availableQuantity(tx, item.id, start, due, undefined, todayBangkok(now))) < line.quantity) {
        short.push(item.name);
      }
    }
    if (short.length > 0) throw new AppError(`ของไม่พอในช่วงวันที่เลือก: ${short.join(", ")}`);
    const created = await tx.loan.create({
      data: {
        borrowerId: actor.id,
        startDate: start,
        dueDate: due,
        purpose: v.purpose,
        status: "PENDING",
        items: { create: v.items.map((i) => ({ itemId: i.itemId, quantity: i.quantity })) },
      },
    });
    await logAudit(tx, {
      actorId: actor.id,
      action: "LOAN_CREATE",
      entity: "Loan",
      entityId: created.id,
      data: { items: v.items },
    });
    return created;
  });
  await emitLoanEvent("CREATED", loan);
  return loan;
}

export async function cancelLoan(actor: SessionUser, loanId: string): Promise<void> {
  const cancelled = await prisma.$transaction(async (tx) => {
    const loan = await tx.loan.findUnique({ where: { id: loanId } });
    if (!loan) throw new AppError("ไม่พบคำขอ");
    const isOwner = loan.borrowerId === actor.id;
    const isStaff = actor.role === "STAFF" || actor.role === "ADMIN";
    if (!isOwner && !isStaff) throw new AppError("ไม่มีสิทธิ์");
    // owner: PENDING/APPROVED; staff (non-owner): APPROVED only
    if (!isOwner && loan.status === "PENDING") throw new AppError("ไม่มีสิทธิ์");
    await transition(tx, loanId, isOwner ? ["PENDING", "APPROVED"] : ["APPROVED"], { status: "CANCELLED" });
    await logAudit(tx, { actorId: actor.id, action: "LOAN_CANCEL", entity: "Loan", entityId: loanId });
    return tx.loan.findUniqueOrThrow({ where: { id: loanId } });
  });
  await emitLoanEvent("CANCELLED", cancelled);
}

const withItems = { items: { include: { item: true }, orderBy: { id: "asc" as const } } };

export async function listMyLoans(actor: SessionUser): Promise<LoanWithItems[]> {
  return prisma.loan.findMany({
    where: { borrowerId: actor.id },
    orderBy: { createdAt: "desc" },
    include: withItems,
  });
}

export async function getLoanForUser(actor: SessionUser, loanId: string): Promise<LoanWithItems> {
  const loan = await prisma.loan.findUnique({ where: { id: loanId }, include: withItems });
  if (!loan) throw new AppError("ไม่พบคำขอ");
  if (loan.borrowerId !== actor.id && actor.role === "BORROWER") throw new AppError("ไม่มีสิทธิ์");
  return loan;
}

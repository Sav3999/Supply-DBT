"use server";

import { ensureWired } from "@/server/wiring";
import { revalidatePath } from "next/cache";
import { toResult, type Result } from "@/lib/result";
import { parseId, requireId } from "@/lib/id";
import { prisma } from "@/lib/db";
import { requireRole } from "@/server/auth/session";
import { cancelLoan, createLoan } from "@/server/loans/request";

export type ActionState = Result<void> | null;

export async function createLoanAction(input: unknown): Promise<Result<{ id: number }>> {
  const result = await toResult(async () => {
    const actor = await requireRole("BORROWER", "STAFF", "ADMIN");
    const loan = await createLoan(actor, input);
    return { id: loan.id };
  });
  revalidatePath("/my-loans");
  return result;
}

export async function cancelLoanAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const loanId = String(fd.get("loanId"));
  const result = await toResult(async () => {
    const actor = await requireRole("BORROWER", "STAFF", "ADMIN");
    await cancelLoan(actor, requireId(loanId));
  });
  revalidatePath("/my-loans");
  revalidatePath(`/my-loans/${loanId}`);
  return result;
}

export type CartItemInfo = { id: number; name: string; imagePath: string | null; active: boolean };

/** ข้อมูลของสำหรับแสดงในตะกร้า (ต้องล็อกอิน) */
export async function cartItemsAction(ids: unknown[]): Promise<CartItemInfo[]> {
  await requireRole("BORROWER", "STAFF", "ADMIN");
  return prisma.item.findMany({
    where: { id: { in: ids.slice(0, 100).map(parseId).filter((n): n is number => n !== null) } },
    select: { id: true, name: true, imagePath: true, active: true },
  });
}

ensureWired();

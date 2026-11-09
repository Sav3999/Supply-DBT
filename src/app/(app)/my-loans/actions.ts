"use server";

import { revalidatePath } from "next/cache";
import { toResult, type Result } from "@/lib/result";
import { prisma } from "@/lib/db";
import { requireRole } from "@/server/auth/session";
import { cancelLoan, createLoan } from "@/server/loans/request";

export type ActionState = Result<void> | null;

export async function createLoanAction(input: unknown): Promise<Result<{ id: string }>> {
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
    await cancelLoan(actor, loanId);
  });
  revalidatePath("/my-loans");
  revalidatePath(`/my-loans/${loanId}`);
  return result;
}

export type CartItemInfo = { id: string; name: string; imagePath: string | null; active: boolean };

/** ข้อมูลของสำหรับแสดงในตะกร้า (ต้องล็อกอิน) */
export async function cartItemsAction(ids: string[]): Promise<CartItemInfo[]> {
  await requireRole("BORROWER", "STAFF", "ADMIN");
  return prisma.item.findMany({
    where: { id: { in: ids.slice(0, 100) } },
    select: { id: true, name: true, imagePath: true, active: true },
  });
}

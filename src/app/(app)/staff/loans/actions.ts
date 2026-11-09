"use server";

import type { Condition } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { toResult, type Result } from "@/lib/result";
import { requireRole } from "@/server/auth/session";
import { cancelLoan } from "@/server/loans/request";
import { approveLoan, handOverLoan, receiveReturn, rejectLoan } from "@/server/loans/staff";

export type ActionState = Result<void> | null;

function refresh(loanId: string) {
  revalidatePath("/staff/loans");
  revalidatePath(`/staff/loans/${loanId}`);
  revalidatePath("/my-loans");
  revalidatePath(`/my-loans/${loanId}`);
}

async function run(fd: FormData, fn: (loanId: string) => Promise<void>): Promise<ActionState> {
  const loanId = String(fd.get("loanId") ?? "");
  const result = await toResult(() => fn(loanId));
  refresh(loanId);
  return result;
}

export async function approveAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(fd, async (loanId) => approveLoan(await requireRole("STAFF"), loanId));
}

export async function rejectAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(fd, async (loanId) => rejectLoan(await requireRole("STAFF"), loanId, String(fd.get("reason") ?? "")));
}

export async function cancelAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(fd, async (loanId) => cancelLoan(await requireRole("STAFF"), loanId));
}

/** ฟอร์มส่งมอบ: checkbox ชื่อ `asset:<loanItemId>` ค่า = assetId */
export async function handOverAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(fd, async (loanId) => {
    const actor = await requireRole("STAFF");
    const assets: Record<string, string[]> = {};
    for (const [key, value] of fd.entries()) {
      if (!key.startsWith("asset:")) continue;
      const lineId = key.slice("asset:".length);
      (assets[lineId] ??= []).push(String(value));
    }
    await handOverLoan(actor, loanId, { assets });
  });
}

/**
 * ฟอร์มรับคืน:
 * - SERIALIZED: checkbox `ret` ค่า `<loanItemId>:<assetId>` + select `cond:<loanItemId>:<assetId>`
 * - QUANTITY: number `qty:<loanItemId>` + select `qcond:<loanItemId>` (0 = ไม่คืนรายการนี้)
 */
export async function returnAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(fd, async (loanId) => {
    const actor = await requireRole("STAFF");
    const serialized = fd.getAll("ret").map((v) => {
      const [loanItemId, assetId] = String(v).split(":");
      return { loanItemId, assetId, condition: String(fd.get(`cond:${v}`) ?? "GOOD") as Condition };
    });
    const quantity: { loanItemId: string; quantity: number; condition: Condition }[] = [];
    for (const [key, value] of fd.entries()) {
      if (!key.startsWith("qty:")) continue;
      const raw = String(value).trim();
      if (raw === "" || raw === "0") continue;
      const loanItemId = key.slice("qty:".length);
      quantity.push({
        loanItemId,
        quantity: Number(raw),
        condition: String(fd.get(`qcond:${loanItemId}`) ?? "GOOD") as Condition,
      });
    }
    await receiveReturn(actor, loanId, { serialized, quantity });
  });
}

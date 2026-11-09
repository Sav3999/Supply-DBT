"use server";

import { revalidatePath } from "next/cache";
import { ensureWired } from "@/server/wiring";
import { AppError, toResult, type Result } from "@/lib/result";
import { requireRole } from "@/server/auth/session";
import { createLinkCode, unlinkLine } from "@/server/line/link";
import { getLineClient } from "@/server/line/client";
import { changePassword, updateProfile } from "@/server/profile";

export type ActionState = Result<void> | null;

export async function updateProfileAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const result = await toResult(async () => {
    const actor = await requireRole("BORROWER", "STAFF", "ADMIN");
    await updateProfile(actor, {
      name: String(fd.get("name") ?? ""),
      department: String(fd.get("department") ?? ""),
      phone: String(fd.get("phone") ?? ""),
    });
  });
  revalidatePath("/profile");
  return result;
}

export async function changePasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return toResult(async () => {
    const actor = await requireRole("BORROWER", "STAFF", "ADMIN");
    await changePassword(actor, {
      current: String(fd.get("current") ?? ""),
      next: String(fd.get("next") ?? ""),
    });
  });
}

export type LinkCodeResult = Result<{ code: string; expiresAt: string }>;

export async function createLinkCodeAction(): Promise<LinkCodeResult> {
  return toResult(async () => {
    const actor = await requireRole("BORROWER", "STAFF", "ADMIN");
    if (!getLineClient().enabled) throw new AppError("ยังไม่เปิดใช้งาน LINE");
    const { code, expiresAt } = await createLinkCode(actor.id);
    return { code, expiresAt: expiresAt.toISOString() };
  });
}

export async function unlinkLineAction(): Promise<ActionState> {
  const result = await toResult(async () => {
    const actor = await requireRole("BORROWER", "STAFF", "ADMIN");
    await unlinkLine(actor.id);
  });
  revalidatePath("/profile");
  return result;
}

ensureWired();

"use server";

import { revalidatePath } from "next/cache";
import { toResult, type Result } from "@/lib/result";
import { requireRole, type SessionUser } from "@/server/auth/session";
import { createCategory, deleteCategory, renameCategory } from "@/server/inventory/categories";

export type ActionState = Result<void> | null;

async function run(fn: (actor: SessionUser) => Promise<unknown>): Promise<ActionState> {
  const result = await toResult(async () => {
    await fn(await requireRole("ADMIN"));
  });
  revalidatePath("/admin/categories");
  return result;
}

export async function createCategoryAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run((a) => createCategory(a, String(fd.get("name") ?? "")));
}
export async function renameCategoryAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run((a) => renameCategory(a, String(fd.get("id")), String(fd.get("name") ?? "")));
}
export async function deleteCategoryAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run((a) => deleteCategory(a, String(fd.get("id"))));
}

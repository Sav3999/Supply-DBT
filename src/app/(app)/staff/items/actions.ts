"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { AssetStatus } from "@prisma/client";
import { AppError, toResult, type Result } from "@/lib/result";
import { requireRole } from "@/server/auth/session";
import { addAsset, setAssetStatus } from "@/server/inventory/assets";
import { createItem, setItemActive, setItemImage, updateItem, type ItemInput } from "@/server/inventory/items";

export type ActionState = Result<void> | null;

function itemInput(fd: FormData): ItemInput {
  return {
    name: String(fd.get("name") ?? ""),
    categoryId: String(fd.get("categoryId") ?? ""),
    description: String(fd.get("description") ?? ""),
    kind: String(fd.get("kind") ?? "") as ItemInput["kind"],
    totalQuantity: String(fd.get("totalQuantity") ?? "0") as unknown as number,
    maxLoanDays: String(fd.get("maxLoanDays") ?? "") as unknown as number,
  };
}

export async function createItemAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const result = await toResult(async () => createItem(await requireRole("STAFF"), itemInput(fd)));
  if (!result.ok) return result;
  revalidatePath("/staff/items");
  redirect(`/staff/items/${result.data.id}`);
}

export async function updateItemAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = String(fd.get("id"));
  const result = await toResult(async () => {
    await updateItem(await requireRole("STAFF"), id, itemInput(fd));
  });
  revalidatePath("/staff/items");
  revalidatePath(`/staff/items/${id}`);
  return result;
}

export async function uploadImageAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = String(fd.get("id"));
  const result = await toResult(async () => {
    const actor = await requireRole("STAFF");
    const file = fd.get("image");
    if (!(file instanceof File) || file.size === 0) throw new AppError("กรุณาเลือกไฟล์รูป");
    await setItemImage(actor, id, file);
  });
  revalidatePath(`/staff/items/${id}`);
  return result;
}

export async function setActiveAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = String(fd.get("id"));
  const result = await toResult(async () => {
    await setItemActive(await requireRole("STAFF"), id, fd.get("active") === "true");
  });
  revalidatePath("/staff/items");
  revalidatePath(`/staff/items/${id}`);
  return result;
}

export async function addAssetAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = String(fd.get("id"));
  const result = await toResult(async () => {
    await addAsset(await requireRole("STAFF"), id, String(fd.get("assetTag") ?? ""));
  });
  revalidatePath(`/staff/items/${id}`);
  return result;
}

export async function assetStatusAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const result = await toResult(async () => {
    await setAssetStatus(
      await requireRole("STAFF"),
      String(fd.get("assetId")),
      String(fd.get("status")) as AssetStatus,
    );
  });
  revalidatePath(`/staff/items/${String(fd.get("id"))}`);
  return result;
}

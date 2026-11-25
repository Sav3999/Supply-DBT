import type { Asset, Category, Item, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/result";
import { logAudit } from "@/server/audit";
import { assertRole, type SessionUser } from "@/server/auth/session";
import { outstandingQuantity } from "@/server/loans/availability";
import { removeUpload, saveUpload } from "./upload";

const THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙";

/**
 * Number from a form field. Empty → undefined (so "required" can report it in Thai
 * instead of z.coerce silently turning "" into 0); Thai digits ๐–๙ are accepted.
 */
function formNumber(value: unknown): unknown {
  if (typeof value !== "string") return value ?? undefined;
  const s = value.trim().replace(/[๐-๙]/g, (d) => String(THAI_DIGITS.indexOf(d)));
  if (s === "") return undefined;
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : Number.NaN;
}

export const itemSchema = z
  .object({
    name: z.string().trim().min(1, "กรุณากรอกชื่อของ"),
    categoryId: z.coerce.number({ error: "กรุณาเลือกหมวดหมู่" }).int("กรุณาเลือกหมวดหมู่").positive("กรุณาเลือกหมวดหมู่"),
    description: z.string().trim().optional(),
    kind: z.enum(["SERIALIZED", "QUANTITY"], { error: "ประเภทไม่ถูกต้อง" }),
    totalQuantity: z.preprocess(
      formNumber,
      z.number({ error: "จำนวนต้องเป็นตัวเลข" }).int("จำนวนต้องเป็นจำนวนเต็ม").min(0, "จำนวนต้องไม่ติดลบ").optional(),
    ),
    maxLoanDays: z.preprocess(
      formNumber,
      z
        .number({
          error: (iss) => (iss.input === undefined ? "กรุณากรอกจำนวนวันที่ยืมได้" : "จำนวนวันต้องเป็นตัวเลข"),
        })
        .int("จำนวนวันต้องเป็นจำนวนเต็ม")
        .min(1, "ยืมได้อย่างน้อย 1 วัน")
        .max(365, "ยืมได้สูงสุด 365 วัน"),
    ),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "QUANTITY" && v.totalQuantity === undefined) {
      ctx.addIssue({ code: "custom", path: ["totalQuantity"], message: "กรุณากรอกจำนวนรวม" });
    }
  })
  .transform((v) => ({ ...v, totalQuantity: v.totalQuantity ?? 0 }));
export type ItemInput = z.input<typeof itemSchema>;

export type ItemWithRefs = Item & { category: Category; assets: Asset[] };

const include = { category: true, assets: { orderBy: { assetTag: "asc" as const } } };

export async function listItems(filter: {
  q?: string;
  categoryId?: number;
  includeInactive?: boolean;
}): Promise<ItemWithRefs[]> {
  const q = filter.q?.trim();
  const where: Prisma.ItemWhereInput = {
    ...(filter.includeInactive ? {} : { active: true }),
    ...(filter.categoryId ? { categoryId: filter.categoryId } : {}),
    ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
  };
  return prisma.item.findMany({ where, orderBy: { name: "asc" }, include });
}

export async function getItem(id: number): Promise<ItemWithRefs | null> {
  return prisma.item.findUnique({ where: { id }, include });
}

export async function createItem(actor: SessionUser, input: ItemInput): Promise<Item> {
  assertRole(actor, "STAFF");
  const v = itemSchema.parse(input);
  const totalQuantity = v.kind === "SERIALIZED" ? 0 : v.totalQuantity;
  return prisma.$transaction(async (tx) => {
    if (!(await tx.category.findUnique({ where: { id: v.categoryId } }))) throw new AppError("ไม่พบหมวดหมู่");
    const item = await tx.item.create({
      data: {
        name: v.name,
        categoryId: v.categoryId,
        description: v.description || null,
        kind: v.kind,
        totalQuantity,
        maxLoanDays: v.maxLoanDays,
      },
    });
    await logAudit(tx, { actorId: actor.id, action: "ITEM_CREATE", entity: "Item", entityId: item.id, data: { name: v.name } });
    return item;
  });
}

export async function updateItem(actor: SessionUser, id: number, input: ItemInput): Promise<Item> {
  assertRole(actor, "STAFF");
  const v = itemSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    // lock the item row so concurrent edits see a consistent total
    await tx.$queryRaw`SELECT id FROM "Item" WHERE id = ${id} FOR UPDATE`;
    const old = await tx.item.findUnique({ where: { id } });
    if (!old) throw new AppError("ไม่พบของ");
    if (old.kind !== v.kind) throw new AppError("เปลี่ยนประเภทของไม่ได้");
    if (!(await tx.category.findUnique({ where: { id: v.categoryId } }))) throw new AppError("ไม่พบหมวดหมู่");
    let totalQuantity = old.totalQuantity;
    if (old.kind === "QUANTITY") {
      if (v.totalQuantity < (await outstandingQuantity(tx, id))) {
        throw new AppError("จำนวนรวมน้อยกว่าจำนวนที่ถูกยืมอยู่");
      }
      totalQuantity = v.totalQuantity;
    }
    const item = await tx.item.update({
      where: { id },
      data: {
        name: v.name,
        categoryId: v.categoryId,
        description: v.description || null,
        totalQuantity,
        maxLoanDays: v.maxLoanDays,
      },
    });
    await logAudit(tx, {
      actorId: actor.id,
      action: "ITEM_UPDATE",
      entity: "Item",
      entityId: id,
      data: {
        from: { name: old.name, totalQuantity: old.totalQuantity, maxLoanDays: old.maxLoanDays },
        to: { name: v.name, totalQuantity, maxLoanDays: v.maxLoanDays },
      },
    });
    return item;
  });
}

export async function setItemImage(actor: SessionUser, itemId: number, file: File): Promise<Item> {
  assertRole(actor, "STAFF");
  if (!(await prisma.item.findUnique({ where: { id: itemId } }))) throw new AppError("ไม่พบของ");
  const imagePath = await saveUpload(file);
  let old: string | null = null;
  let item: Item;
  try {
    item = await prisma.$transaction(async (tx) => {
      const before = await tx.item.findUnique({ where: { id: itemId }, select: { imagePath: true } });
      if (!before) throw new AppError("ไม่พบของ");
      old = before.imagePath;
      const updated = await tx.item.update({ where: { id: itemId }, data: { imagePath } });
      await logAudit(tx, { actorId: actor.id, action: "ITEM_UPDATE", entity: "Item", entityId: itemId, data: { imagePath } });
      return updated;
    });
  } catch (e) {
    await removeUpload(imagePath); // the new file is not referenced by anything
    throw e;
  }
  await removeUpload(old);
  return item;
}

/** Take the picture off an item (and delete the file). */
export async function clearItemImage(actor: SessionUser, itemId: number): Promise<void> {
  assertRole(actor, "STAFF");
  const old = await prisma.$transaction(async (tx) => {
    const before = await tx.item.findUnique({ where: { id: itemId }, select: { imagePath: true } });
    if (!before) throw new AppError("ไม่พบของ");
    await tx.item.update({ where: { id: itemId }, data: { imagePath: null } });
    await logAudit(tx, { actorId: actor.id, action: "ITEM_IMAGE_REMOVE", entity: "Item", entityId: itemId, data: { imagePath: before.imagePath } });
    return before.imagePath;
  });
  await removeUpload(old);
}

export async function setItemActive(actor: SessionUser, itemId: number, active: boolean): Promise<Item> {
  assertRole(actor, "STAFF");
  return prisma.$transaction(async (tx) => {
    if (!(await tx.item.findUnique({ where: { id: itemId } }))) throw new AppError("ไม่พบของ");
    const item = await tx.item.update({ where: { id: itemId }, data: { active } });
    await logAudit(tx, { actorId: actor.id, action: "ITEM_UPDATE", entity: "Item", entityId: itemId, data: { active } });
    return item;
  });
}

/**
 * Hard-delete an item that was never borrowed (its assets go with it). Items with
 * loan history must stay for the records — staff turn those off instead.
 */
export async function deleteItem(actor: SessionUser, itemId: number): Promise<void> {
  assertRole(actor, "STAFF");
  const imagePath = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Item" WHERE id = ${itemId} FOR UPDATE`;
    const item = await tx.item.findUnique({ where: { id: itemId } });
    if (!item) throw new AppError("ไม่พบของ");
    if ((await tx.loanItem.count({ where: { itemId } })) > 0) {
      throw new AppError("ลบไม่ได้ เพราะของนี้มีประวัติการยืม ให้กด “ปิดการใช้งาน” แทน");
    }
    await tx.asset.deleteMany({ where: { itemId } });
    await tx.item.delete({ where: { id: itemId } });
    await logAudit(tx, { actorId: actor.id, action: "ITEM_DELETE", entity: "Item", entityId: itemId, data: { name: item.name } });
    return item.imagePath;
  });
  await removeUpload(imagePath);
}

/** What blocks deleting an item: how many loans used it, and which asset ids were ever lent. */
export async function itemDeleteInfo(itemId: number): Promise<{ loanCount: number; lentAssetIds: Set<number> }> {
  const [loanCount, lent] = await Promise.all([
    prisma.loanItem.count({ where: { itemId } }),
    prisma.loanAsset.findMany({ where: { asset: { itemId } }, select: { assetId: true }, distinct: ["assetId"] }),
  ]);
  return { loanCount, lentAssetIds: new Set(lent.map((l) => l.assetId)) };
}

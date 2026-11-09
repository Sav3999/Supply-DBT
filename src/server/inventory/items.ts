import type { Asset, Category, Item, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/result";
import { logAudit } from "@/server/audit";
import { assertRole, type SessionUser } from "@/server/auth/session";
import { outstandingQuantity } from "@/server/loans/availability";
import { saveUpload } from "./upload";

export const itemSchema = z.object({
  name: z.string().trim().min(1, "กรุณากรอกชื่อของ"),
  categoryId: z.string().min(1, "กรุณาเลือกหมวดหมู่"),
  description: z.string().trim().optional(),
  kind: z.enum(["SERIALIZED", "QUANTITY"], { error: "ประเภทไม่ถูกต้อง" }),
  totalQuantity: z.coerce.number().int("จำนวนต้องเป็นจำนวนเต็ม").min(0, "จำนวนต้องไม่ติดลบ").default(0),
  maxLoanDays: z.coerce
    .number()
    .int("จำนวนวันต้องเป็นจำนวนเต็ม")
    .min(1, "ยืมได้อย่างน้อย 1 วัน")
    .max(365, "ยืมได้สูงสุด 365 วัน"),
});
export type ItemInput = z.input<typeof itemSchema>;

export type ItemWithRefs = Item & { category: Category; assets: Asset[] };

const include = { category: true, assets: { orderBy: { assetTag: "asc" as const } } };

export async function listItems(filter: {
  q?: string;
  categoryId?: string;
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

export async function getItem(id: string): Promise<ItemWithRefs | null> {
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

export async function updateItem(actor: SessionUser, id: string, input: ItemInput): Promise<Item> {
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

export async function setItemImage(actor: SessionUser, itemId: string, file: File): Promise<Item> {
  assertRole(actor, "STAFF");
  if (!(await prisma.item.findUnique({ where: { id: itemId } }))) throw new AppError("ไม่พบของ");
  const imagePath = await saveUpload(file);
  return prisma.$transaction(async (tx) => {
    const item = await tx.item.update({ where: { id: itemId }, data: { imagePath } });
    await logAudit(tx, { actorId: actor.id, action: "ITEM_UPDATE", entity: "Item", entityId: itemId, data: { imagePath } });
    return item;
  });
}

export async function setItemActive(actor: SessionUser, itemId: string, active: boolean): Promise<Item> {
  assertRole(actor, "STAFF");
  return prisma.$transaction(async (tx) => {
    if (!(await tx.item.findUnique({ where: { id: itemId } }))) throw new AppError("ไม่พบของ");
    const item = await tx.item.update({ where: { id: itemId }, data: { active } });
    await logAudit(tx, { actorId: actor.id, action: "ITEM_UPDATE", entity: "Item", entityId: itemId, data: { active } });
    return item;
  });
}
